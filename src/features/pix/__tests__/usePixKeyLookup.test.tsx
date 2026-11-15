/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { ApiError } from '@/services/api-error'

const mockPixKeyInfo = jest.fn()
jest.mock('@/services/pix', () => ({ pixApi: { lookupKey: (key: string) => mockPixKeyInfo(key) } }))

import { usePixKeyLookup } from '../usePixKeyLookup'

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
            first = await result.current.lookup('11144477735')
            await result.current.lookup('11144477735')
        })

        expect(first).toMatchObject({ status: 'found', info: { ownAccount: true } })
        expect(result.current.result).toMatchObject({ key: '11144477735', status: 'found' })
        expect(mockPixKeyInfo).toHaveBeenCalledTimes(1)
    })

    it('carries whose key it is and whether its bank is paid, as the API tells', async () => {
        mockPixKeyInfo.mockResolvedValueOnce(info({ ownAccount: false })).mockResolvedValueOnce(info({ blocked: true }))
        const { result } = renderHook(() => usePixKeyLookup(), { wrapper })

        await act(async () => {
            expect(await result.current.lookup('+5511987654321')).toMatchObject({ info: { ownAccount: false } })
            expect(await result.current.lookup('ana@example.com')).toMatchObject({ info: { blocked: true } })
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

    // API review 2 (abeb3b909): POST /pix/key refuses a Pix code with 400 PIX_KEY_IS_QR_CODE
    it('reads a code refused as a key as a code, which the key step sends to the scanner', async () => {
        mockPixKeyInfo.mockRejectedValueOnce(new ApiError('qr', { status: 400, code: 'PIX_KEY_IS_QR_CODE' }))
        const { result } = renderHook(() => usePixKeyLookup(), { wrapper })

        await act(async () => {
            expect(await result.current.lookup('br.gov.bcb.pix')).toEqual({ key: 'br.gov.bcb.pix', status: 'qr-code' })
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
            const pending = result.current.lookup('11144477735').then((value) => (outcome = value))
            await jest.advanceTimersByTimeAsync(1100)
            await pending
        })

        expect(mockPixKeyInfo).toHaveBeenCalledTimes(2)
        expect(outcome).toMatchObject({ status: 'found' })
    })
})
