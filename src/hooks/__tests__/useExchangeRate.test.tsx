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

const makeWrapper = () => {
    const client = new QueryClient({
        defaultOptions: { queries: { gcTime: 0, retryDelay: 0 } },
    })
    const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client }, children)
    return { client, wrapper }
}

describe('useExchangeRate retries', () => {
    beforeEach(() => mockFetchDisplayRate.mockReset())

    it('does not amplify a public FX rate-limit response', async () => {
        mockFetchDisplayRate.mockRejectedValue(new FxApiError(429, 'PLN', 'EUR'))
        const { client, wrapper } = makeWrapper()

        const { result } = renderHook(() => useExchangeRate({ sourceCurrency: 'PLN', destinationCurrency: 'EUR' }), {
            wrapper,
        })

        await waitFor(() => expect(result.current.isError).toBe(true))
        expect(mockFetchDisplayRate).toHaveBeenCalledTimes(1)
        client.clear()
    })

    it('clears a retained conversion when a background refresh reaches a terminal error', async () => {
        mockFetchDisplayRate.mockResolvedValueOnce(0.25).mockRejectedValueOnce(new FxApiError(429, 'PLN', 'EUR'))
        const { client, wrapper } = makeWrapper()

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

/**
 * A swap changes the pair and the source amount in the same render. The hook
 * used to store the derived side from an effect fed by a DEBOUNCED source
 * amount, so the new pair's rate met the old amount first: "8.56 EUR →
 * 11.68 USD" for half a second, then the right quote (TASK-21369). Every
 * amount is now derived at render from the current pair, rate and typed side,
 * so no render can mix two pairs — including when the reversed pair's rate
 * arrives before, after, or instead of the old one's.
 */
describe('useExchangeRate across a swap (TASK-21369)', () => {
    type Deferred = { resolve: (rate: number) => void; promise: Promise<number> }
    const deferred = (): Deferred => {
        let resolve!: (rate: number) => void
        const promise = new Promise<number>((r) => (resolve = r))
        return { resolve, promise }
    }

    let pending: Record<string, Deferred>
    beforeEach(() => {
        mockFetchDisplayRate.mockReset()
        pending = {}
        mockFetchDisplayRate.mockImplementation((from: string, to: string) => {
            const key = `${from}/${to}`
            pending[key] ??= deferred()
            return pending[key].promise
        })
    })

    const renderPair = () => {
        const { client, wrapper } = makeWrapper()
        // every frame the hook ever COMMITTED (an effect, so the render pass
        // React discards while the hook adjusts state does not count), so a
        // wrong intermediate quote is caught even if a later frame corrected it
        const seen: { pair: string; source: number | ''; destination: number | ''; isLoading: boolean }[] = []
        const hook = renderHook(
            (props: { sourceCurrency: string; destinationCurrency: string; initialSourceAmount: number }) => {
                const value = useExchangeRate(props)
                React.useEffect(() => {
                    seen.push({
                        pair: `${props.sourceCurrency}/${props.destinationCurrency}`,
                        source: value.sourceAmount,
                        destination: value.destinationAmount,
                        isLoading: value.isLoading,
                    })
                })
                return value
            },
            { wrapper, initialProps: { sourceCurrency: 'USD', destinationCurrency: 'EUR', initialSourceAmount: 10 } }
        )
        return { ...hook, client, seen }
    }

    it('quotes the new pair from its own rate and the new amount — never the old amount', async () => {
        const { result, rerender, client, seen } = renderPair()
        await act(async () => pending['USD/EUR'].resolve(0.8563))
        await waitFor(() => expect(result.current.destinationAmount).toBeCloseTo(8.563))

        // swap: the URL now says EUR → USD with the amount the user just saw
        rerender({ sourceCurrency: 'EUR', destinationCurrency: 'USD', initialSourceAmount: 8.56 })

        // the reversed rate is still in flight: the source is already the
        // swapped amount and the other side is empty, not the old pair's quote
        expect(result.current.sourceAmount).toBe(8.56)
        expect(result.current.destinationAmount).toBe('')
        expect(result.current.isLoading).toBe(true)

        await act(async () => pending['EUR/USD'].resolve(1.168))
        await waitFor(() => expect(result.current.isLoading).toBe(false))

        // the quote lands from the swapped amount at once — no debounce window
        expect(result.current.sourceAmount).toBe(8.56)
        expect(result.current.destinationAmount).toBeCloseTo(8.56 * 1.168)

        // and at no render did the old amount meet the new rate (10 × 1.168)
        const wrong = seen.filter(
            (frame) => frame.pair === 'EUR/USD' && typeof frame.destination === 'number' && frame.destination > 11
        )
        expect(wrong).toEqual([])
        client.clear()
    })

    it('ignores a late response for the previous pair (out-of-order responses)', async () => {
        const { result, rerender, client } = renderPair()
        // USD/EUR is slow; the user swaps before it arrives
        rerender({ sourceCurrency: 'EUR', destinationCurrency: 'USD', initialSourceAmount: 10 })
        await act(async () => pending['EUR/USD'].resolve(1.168))
        await waitFor(() => expect(result.current.destinationAmount).toBeCloseTo(11.68))

        // the slow first response finally lands — for a pair no longer shown
        await act(async () => pending['USD/EUR'].resolve(0.8563))
        await act(async () => {
            await Promise.resolve()
        })

        expect(result.current.exchangeRate).toBe(1.168)
        expect(result.current.destinationAmount).toBeCloseTo(11.68)
        expect(result.current.isError).toBe(false)
        client.clear()
    })

    it('swapping back to a cached pair lands the right quote in the first render, with no loading', async () => {
        const { result, rerender, client, seen } = renderPair()
        await act(async () => pending['USD/EUR'].resolve(0.8563))
        await waitFor(() => expect(result.current.destinationAmount).toBeCloseTo(8.563))
        rerender({ sourceCurrency: 'EUR', destinationCurrency: 'USD', initialSourceAmount: 8.56 })
        await act(async () => pending['EUR/USD'].resolve(1.168))
        await waitFor(() => expect(result.current.destinationAmount).toBeCloseTo(8.56 * 1.168))

        seen.length = 0
        rerender({ sourceCurrency: 'USD', destinationCurrency: 'EUR', initialSourceAmount: 10 })

        expect(seen[0]).toMatchObject({ pair: 'USD/EUR', source: 10, isLoading: false })
        expect(seen[0].destination).toBeCloseTo(8.563)
        expect(mockFetchDisplayRate).toHaveBeenCalledTimes(2)
        client.clear()
    })

    it('a "you get" amount the user typed does not survive the swap as a stale derived source', async () => {
        const { result, rerender, client } = renderPair()
        await act(async () => pending['USD/EUR'].resolve(0.8))
        await waitFor(() => expect(result.current.destinationAmount).toBeCloseTo(8))

        act(() => result.current.handleDestinationAmountChange('100', 100))
        expect(result.current.sourceAmount).toBe(125)
        expect(result.current.destinationInputValue).toBe('100')

        rerender({ sourceCurrency: 'EUR', destinationCurrency: 'USD', initialSourceAmount: 100 })
        await act(async () => pending['EUR/USD'].resolve(1.25))
        await waitFor(() => expect(result.current.isLoading).toBe(false))

        // the swapped pair starts from its source: 100 EUR → 125 USD, and the
        // typed "100" no longer echoes as the destination text
        expect(result.current.sourceAmount).toBe(100)
        expect(result.current.destinationAmount).toBeCloseTo(125)
        expect(result.current.destinationInputValue).toBe('125.00')
        client.clear()
    })

    it('a background refresh re-derives the quote in place without a loading flash', async () => {
        const { result, client, seen } = renderPair()
        await act(async () => pending['USD/EUR'].resolve(0.8))
        await waitFor(() => expect(result.current.destinationAmount).toBeCloseTo(8))

        seen.length = 0
        mockFetchDisplayRate.mockResolvedValueOnce(0.9)
        await act(async () => {
            await client.invalidateQueries({ queryKey: ['exchangeRate', 'USD', 'EUR'] })
        })
        await waitFor(() => expect(result.current.destinationAmount).toBeCloseTo(9))

        // the refresh replaced the quote in place: no committed frame showed
        // the skeleton or an empty side on the way
        expect(seen.some((frame) => frame.isLoading || frame.destination === '')).toBe(false)
        client.clear()
    })
})
