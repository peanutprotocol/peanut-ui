/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { ApiError } from '@/services/api-error'

const mockPixKeyInfo = jest.fn()
jest.mock('@/services/pix', () => ({ pixApi: { lookupKey: (key: string) => mockPixKeyInfo(key) } }))

import { usePixKeyLookup } from '../hooks/usePixKeyLookup'

const info = (overrides: Record<string, unknown> = {}) => ({
    holderName: 'Ana Souza',
    holderTaxIdMasked: '***.456.789-**',
    bankName: 'Banco Inter',
    ispb: '00416968',
    ownAccount: true,
    blocked: false,
    ...overrides,
})

describe('usePixKeyLookup', () => {
    let queryClient: QueryClient
    const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    beforeEach(() => {
        jest.clearAllMocks()
        jest.useRealTimers()
        queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    })

    it('resolves the own key and remembers it: a second look costs no DICT tokens', async () => {
        mockPixKeyInfo.mockResolvedValue(info())
        const { result } = renderHook(() => usePixKeyLookup(), { wrapper })

        let first: Awaited<ReturnType<typeof result.current.lookup>> | undefined
        await act(async () => {
            first = await result.current.lookup('09579927189')
            await result.current.lookup('09579927189')
        })

        expect(first).toMatchObject({ status: 'found', verdict: 'own' })
        expect(result.current.result).toMatchObject({ key: '09579927189', status: 'found', verdict: 'own' })
        expect(mockPixKeyInfo).toHaveBeenCalledTimes(1)
    })

    it("tells someone else's key and a blocked bank apart from the own one", async () => {
        mockPixKeyInfo.mockResolvedValueOnce(info({ ownAccount: false })).mockResolvedValueOnce(info({ blocked: true }))
        const { result } = renderHook(() => usePixKeyLookup(), { wrapper })

        await act(async () => {
            expect(await result.current.lookup('+5511987654321')).toMatchObject({ verdict: 'not-own' })
            expect(await result.current.lookup('ana@example.com')).toMatchObject({ verdict: 'blocked' })
        })
    })

    it('reads a 404 as a key that does not exist, and any other failure as a failed check', async () => {
        mockPixKeyInfo
            .mockRejectedValueOnce(new ApiError('not found', { status: 404 }))
            .mockRejectedValueOnce(new ApiError('down', { status: 502, code: 'PROVIDER_UNAVAILABLE' }))
        const { result } = renderHook(() => usePixKeyLookup(), { wrapper })

        await act(async () => {
            expect(await result.current.lookup('11111111111')).toEqual({ key: '11111111111', status: 'not-found' })
            expect(await result.current.lookup('22222222222')).toEqual({ key: '22222222222', status: 'failed' })
        })
    })

    it('waits out the one-lookup-per-second limit once, then retries', async () => {
        jest.useFakeTimers()
        mockPixKeyInfo
            .mockRejectedValueOnce(new ApiError('slow down', { status: 429, code: 'PIX_KEY_LOOKUP_THROTTLED' }))
            .mockResolvedValueOnce(info())
        const { result } = renderHook(() => usePixKeyLookup(), { wrapper })

        let outcome: unknown
        await act(async () => {
            const pending = result.current.lookup('09579927189').then((value) => (outcome = value))
            await jest.advanceTimersByTimeAsync(1100)
            await pending
        })

        expect(mockPixKeyInfo).toHaveBeenCalledTimes(2)
        expect(outcome).toMatchObject({ status: 'found', verdict: 'own' })
    })
})
