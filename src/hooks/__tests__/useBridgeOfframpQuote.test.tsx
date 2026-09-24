import React from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query'

const mockGetOfframpQuote = jest.fn()
jest.mock('@/app/actions/offramp', () => ({
    getOfframpQuote: (...args: unknown[]) => mockGetOfframpQuote(...args),
}))

import { useBridgeOfframpQuote } from '../useBridgeOfframpQuote'

const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } })}>
        {children}
    </QueryClientProvider>
)

const quote = (overrides: Record<string, unknown> = {}) => ({
    destinationCurrency: 'eur',
    rate: '0.891',
    updatedAt: '2026-09-24T15:54:16.373Z',
    destinationAmount: '2000.00',
    sourceAmount: '2244.56',
    pricing: 'bridge_rate',
    ...overrides,
})

const BANK_AMOUNT = { destinationAmount: '2000.00' }

beforeEach(() => jest.clearAllMocks())

describe('useBridgeOfframpQuote', () => {
    it('returns the quote for the typed bank amount', async () => {
        mockGetOfframpQuote.mockResolvedValue({ data: quote() })

        const { result } = renderHook(() => useBridgeOfframpQuote({ currency: 'eur', amount: BANK_AMOUNT }), {
            wrapper,
        })

        await waitFor(() => expect(result.current.quote?.sourceAmount).toBe('2244.56'))
        expect(mockGetOfframpQuote).toHaveBeenCalledWith('eur', BANK_AMOUNT)
        expect(result.current.receivedAt).toBeGreaterThan(0)
    })

    it('returns the quote for typed USDC', async () => {
        mockGetOfframpQuote.mockResolvedValue({ data: quote({ sourceAmount: '50', destinationAmount: '44.55' }) })

        const { result } = renderHook(
            () => useBridgeOfframpQuote({ currency: 'eur', amount: { sourceAmount: '50' } }),
            { wrapper }
        )

        await waitFor(() => expect(result.current.quote?.destinationAmount).toBe('44.55'))
        expect(mockGetOfframpQuote).toHaveBeenCalledWith('eur', { sourceAmount: '50' })
    })

    it('does not ask for a USD amount', () => {
        renderHook(() => useBridgeOfframpQuote({ currency: null }), { wrapper })
        expect(mockGetOfframpQuote).not.toHaveBeenCalled()
    })

    it('a failed quote is an error, never a guessed amount', async () => {
        mockGetOfframpQuote.mockResolvedValue({ error: 'no rate' })

        const { result } = renderHook(() => useBridgeOfframpQuote({ currency: 'eur', amount: BANK_AMOUNT }), {
            wrapper,
        })

        await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 3000 })
        expect(result.current.quote).toBeNull()
    })

    it('a quote for another amount or currency is an error, never shown for this one', async () => {
        mockGetOfframpQuote.mockResolvedValue({ data: quote({ destinationAmount: '1500.00' }) })

        const { result } = renderHook(() => useBridgeOfframpQuote({ currency: 'eur', amount: BANK_AMOUNT }), {
            wrapper,
        })

        await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 3000 })
        expect(result.current.quote).toBeNull()
    })

    it('a failed refresh drops the last quote instead of leaving it confirmable', async () => {
        mockGetOfframpQuote.mockResolvedValueOnce({ data: quote({ rate: '0.8955', sourceAmount: '2233.39' }) })
        const { result } = renderHook(() => useBridgeOfframpQuote({ currency: 'eur', amount: BANK_AMOUNT }), {
            wrapper,
        })
        await waitFor(() => expect(result.current.quote?.sourceAmount).toBe('2233.39'))

        mockGetOfframpQuote.mockResolvedValue({ error: 'no rate' })
        await result.current.refetch()

        await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 3000 })
        expect(result.current.quote).toBeNull()
    })

    describe('refreshing on return to the tab', () => {
        afterEach(() => focusManager.setFocused(undefined))

        const returnToTab = () =>
            act(async () => {
                focusManager.setFocused(false)
                focusManager.setFocused(true)
            })

        it('a signed quote does not change on its own: the numbers on screen are the ones confirmed', async () => {
            mockGetOfframpQuote.mockResolvedValue({ data: quote({ pricing: 'fixed_output', quoteId: 'quote-1' }) })
            const { result } = renderHook(() => useBridgeOfframpQuote({ currency: 'eur', amount: BANK_AMOUNT }), {
                wrapper,
            })
            await waitFor(() => expect(result.current.quote?.quoteId).toBe('quote-1'))

            await returnToTab()

            expect(mockGetOfframpQuote).toHaveBeenCalledTimes(1)
        })

        it('a Bridge-rate estimate follows the rate', async () => {
            mockGetOfframpQuote.mockResolvedValue({ data: quote() })
            const { result } = renderHook(() => useBridgeOfframpQuote({ currency: 'eur', amount: BANK_AMOUNT }), {
                wrapper,
            })
            await waitFor(() => expect(result.current.quote).not.toBeNull())

            await returnToTab()

            await waitFor(() => expect(mockGetOfframpQuote).toHaveBeenCalledTimes(2))
        })
    })

    it('a discarded quote stays hidden until a new quote replaces it', async () => {
        mockGetOfframpQuote.mockResolvedValueOnce({
            data: quote({ pricing: 'fixed_output', quoteId: 'quote-1', sourceAmount: '2240.11' }),
        })
        const { result } = renderHook(() => useBridgeOfframpQuote({ currency: 'eur', amount: BANK_AMOUNT }), {
            wrapper,
        })
        await waitFor(() => expect(result.current.quote?.quoteId).toBe('quote-1'))

        let resolveNext: (value: unknown) => void = () => {}
        mockGetOfframpQuote.mockReturnValueOnce(new Promise((resolve) => (resolveNext = resolve)))
        await act(async () => {
            result.current.discard('quote-1')
        })

        expect(result.current.quote).toBeNull()
        expect(mockGetOfframpQuote).toHaveBeenCalledTimes(2)

        await act(async () => {
            resolveNext({ data: quote({ pricing: 'fixed_output', quoteId: 'quote-2', sourceAmount: '2241.37' }) })
        })
        await waitFor(() => expect(result.current.quote?.quoteId).toBe('quote-2'))
        expect(result.current.quote?.sourceAmount).toBe('2241.37')
    })
})
