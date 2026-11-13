/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { ApiError } from '@/services/api-error'

const mockLookup = jest.fn()
jest.mock('@/services/pix', () => ({ pixApi: { lookupKey: (key: string) => mockLookup(key) } }))

import { CHECK_PENDING_RETRIES, CHECK_PENDING_RETRY_MS, usePixKeyLookup } from '../usePixKeyLookup'

/**
 * POST /pix/key on Bridge (API-CONTRACT.md section 6): the holder and bank Bridge validated, whose
 * key it is, and an answer for every refusal. Whose key it is is never guessed.
 */
const bridgeInfo = { holderName: 'BRUNO LIMA', holderTaxIdMasked: null, bankName: 'Nu Pagamentos S.A.', ispb: null }
const refused = (status: number, code?: string) => new ApiError('refused', { status, code })

describe('usePixKeyLookup on Bridge', () => {
    let queryClient: QueryClient
    const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
    beforeEach(() => {
        jest.clearAllMocks()
        jest.useRealTimers()
        queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    })

    it("reads another person's key as such: a key the flow can pay as a send", async () => {
        mockLookup.mockResolvedValue({ ...bridgeInfo, ownAccount: false, blocked: false })
        const { result } = renderHook(() => usePixKeyLookup(), { wrapper })
        await act(async () => {
            expect(await result.current.lookup('11144477735')).toMatchObject({
                status: 'found',
                verdict: 'not-own',
                info: { holderName: 'BRUNO LIMA', bankName: 'Nu Pagamentos S.A.' },
            })
        })
    })

    it('asks again while Bridge still checks the key, and finds it on a later answer', async () => {
        jest.useFakeTimers()
        mockLookup
            .mockRejectedValueOnce(refused(409, 'PIX_KEY_CHECK_PENDING'))
            .mockResolvedValueOnce({ ...bridgeInfo, ownAccount: true, blocked: false })
        const { result } = renderHook(() => usePixKeyLookup(), { wrapper })
        let outcome: unknown
        await act(async () => {
            const pending = result.current.lookup('ana@example.com').then((value) => (outcome = value))
            await jest.advanceTimersByTimeAsync(CHECK_PENDING_RETRY_MS)
            await pending
        })
        expect(mockLookup).toHaveBeenCalledTimes(2)
        expect(outcome).toMatchObject({ status: 'found', verdict: 'own' })
    })

    it('stops after a bounded number of tries and says the check is still running, guessing no holder', async () => {
        jest.useFakeTimers()
        mockLookup.mockRejectedValue(refused(409, 'PIX_KEY_CHECK_PENDING'))
        const { result } = renderHook(() => usePixKeyLookup(), { wrapper })
        let outcome: unknown
        await act(async () => {
            const pending = result.current.lookup('ana@example.com').then((value) => (outcome = value))
            await jest.advanceTimersByTimeAsync(CHECK_PENDING_RETRY_MS * (CHECK_PENDING_RETRIES + 1))
            await pending
        })
        expect(mockLookup).toHaveBeenCalledTimes(CHECK_PENDING_RETRIES + 1)
        expect(outcome).toEqual({ key: 'ana@example.com', status: 'checking' })
    })

    it.each([
        ['400 not a key in Bridge’s format', refused(400, 'PIX_KEY_NOT_FOUND'), { status: 'not-found' }],
        ['422 a key Bridge refused', refused(422, 'PIX_KEY_NOT_FOUND'), { status: 'not-found' }],
        ['409 a key a payout bounced from', refused(409, 'BANK_ACCOUNT_NOT_USABLE'), { status: 'unusable' }],
        ['403 the route moved', refused(403, 'ROUTE_NOT_AVAILABLE'), { status: 'refused', residence: false }],
        ['403 the residence block', refused(403), { status: 'refused', residence: true }],
        ['502 Bridge down', refused(502, 'PROVIDER_UNAVAILABLE'), { status: 'failed' }],
        ['a timeout', Object.assign(new Error('timed out'), { name: 'ConnectionTimeoutError' }), { status: 'failed' }],
    ])('answers %s with its own outcome', async (_case, error, expected) => {
        mockLookup.mockRejectedValue(error)
        const { result } = renderHook(() => usePixKeyLookup(), { wrapper })
        await act(async () => {
            expect(await result.current.lookup('11144477735')).toEqual({ key: '11144477735', ...expected })
        })
    })

    it('says the lookups were throttled once waiting a second did not help', async () => {
        jest.useFakeTimers()
        mockLookup.mockRejectedValue(refused(429, 'PIX_KEY_LOOKUP_THROTTLED'))
        const { result } = renderHook(() => usePixKeyLookup(), { wrapper })
        let outcome: unknown
        await act(async () => {
            const pending = result.current.lookup('11144477735').then((value) => (outcome = value))
            await jest.advanceTimersByTimeAsync(1100)
            await pending
        })
        expect(outcome).toEqual({ key: '11144477735', status: 'throttled' })
    })
})
