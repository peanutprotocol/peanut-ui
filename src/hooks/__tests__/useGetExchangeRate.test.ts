import { renderHook, waitFor } from '@testing-library/react'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import useGetExchangeRate from '@/hooks/useGetExchangeRate'
import { AccountType } from '@/interfaces/interfaces'

// `getExchangeRate` performs a server fetch in real use. We mock it to capture
// whether it was called — the regression test for PEANUT-UI-QHR is that
// non-Bridge AccountType values must NOT cause a network call.
const getExchangeRateMock = jest.fn()
jest.mock('@/app/actions/exchange-rate', () => ({
    getExchangeRate: (...args: unknown[]) => getExchangeRateMock(...args),
}))

const wrapper = ({ children }: { children: React.ReactNode }) => {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
    })
    return React.createElement(QueryClientProvider, { client }, children)
}

describe('useGetExchangeRate', () => {
    beforeEach(() => {
        getExchangeRateMock.mockReset()
    })

    it('returns 1 and skips the network call for AccountType.US (USD↔USD)', async () => {
        const { result } = renderHook(() => useGetExchangeRate({ accountType: AccountType.US }), { wrapper })
        await waitFor(() => expect(result.current.exchangeRate).toBe('1'))
        expect(getExchangeRateMock).not.toHaveBeenCalled()
    })

    // PEANUT-UI-QHR regression: the BE `/bridge/exchange-rate` enum is
    // {iban,us,clabe,gb}. Any other AccountType (MANTECA, EVM_ADDRESS,
    // PEANUT_WALLET) would 400 — the hook must short-circuit instead of
    // making the network call.
    it.each([AccountType.MANTECA, AccountType.EVM_ADDRESS, AccountType.PEANUT_WALLET])(
        'returns 1 and skips the network call for non-Bridge type: %s',
        async (accountType) => {
            const { result } = renderHook(() => useGetExchangeRate({ accountType }), { wrapper })
            await waitFor(() => expect(result.current.exchangeRate).toBe('1'))
            expect(getExchangeRateMock).not.toHaveBeenCalled()
        }
    )

    it.each([AccountType.IBAN, AccountType.CLABE, AccountType.GB])(
        'calls the network for Bridge FX type: %s and returns its sell_rate',
        async (accountType) => {
            getExchangeRateMock.mockResolvedValue({ data: { sell_rate: '1.05' } })
            const { result } = renderHook(() => useGetExchangeRate({ accountType }), { wrapper })
            await waitFor(() => expect(result.current.exchangeRate).toBe('1.05'))
            expect(getExchangeRateMock).toHaveBeenCalledWith(accountType)
        }
    )

    it('falls back to 1 when the network returns an error', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
        getExchangeRateMock.mockResolvedValue({ error: 'upstream 500' })
        const { result } = renderHook(() => useGetExchangeRate({ accountType: AccountType.IBAN }), { wrapper })
        await waitFor(() => expect(result.current.exchangeRate).toBe('1'))
        consoleErrorSpy.mockRestore()
    })
})
