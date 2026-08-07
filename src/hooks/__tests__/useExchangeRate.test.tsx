import { act, renderHook, waitFor } from '@testing-library/react'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useExchangeRate } from '@/hooks/useExchangeRate'
import { fetchDisplayRate, FxApiError } from '@/utils/fx.utils'

jest.mock('@/utils/fx.utils', () => {
    class MockFxApiError extends Error {
        constructor(readonly status: number) {
            super(`FX API returned ${status}`)
        }
    }
    return { fetchDisplayRate: jest.fn(), FxApiError: MockFxApiError }
})

const mockFetchDisplayRate = fetchDisplayRate as jest.Mock

describe('useExchangeRate retries', () => {
    beforeEach(() => mockFetchDisplayRate.mockReset())

    it('does not amplify a public FX rate-limit response', async () => {
        mockFetchDisplayRate.mockRejectedValue(new FxApiError(429, 'PLN', 'EUR'))
        const client = new QueryClient({
            defaultOptions: { queries: { gcTime: 0, retryDelay: 0 } },
        })
        const wrapper = ({ children }: { children: React.ReactNode }) =>
            React.createElement(QueryClientProvider, { client }, children)

        const { result } = renderHook(() => useExchangeRate({ sourceCurrency: 'PLN', destinationCurrency: 'EUR' }), {
            wrapper,
        })

        await waitFor(() => expect(result.current.isError).toBe(true))
        expect(mockFetchDisplayRate).toHaveBeenCalledTimes(1)
        client.clear()
    })

    it('clears a retained conversion when a background refresh reaches a terminal error', async () => {
        mockFetchDisplayRate.mockResolvedValueOnce(0.25).mockRejectedValueOnce(new FxApiError(429, 'PLN', 'EUR'))
        const client = new QueryClient({
            defaultOptions: { queries: { gcTime: 0, retryDelay: 0 } },
        })
        const wrapper = ({ children }: { children: React.ReactNode }) =>
            React.createElement(QueryClientProvider, { client }, children)

        const { result } = renderHook(
            () => useExchangeRate({ sourceCurrency: 'PLN', destinationCurrency: 'EUR', initialSourceAmount: 10 }),
            { wrapper }
        )

        await waitFor(() => expect(result.current.destinationAmount).toBe(2.5))

        await act(async () => {
            await client.invalidateQueries({ queryKey: ['exchangeRate', 'PLN', 'EUR'] })
        })

        await waitFor(() => {
            expect(result.current.isError).toBe(true)
            expect(result.current.exchangeRate).toBe(0)
            expect(result.current.destinationAmount).toBe('')
            expect(result.current.destinationInputValue).toBe('')
        })
        expect(mockFetchDisplayRate).toHaveBeenCalledTimes(2)
        client.clear()
    })
})
