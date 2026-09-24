import React from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

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

beforeEach(() => jest.clearAllMocks())

describe('useBridgeOfframpQuote', () => {
    it('returns the quote for the typed bank amount', async () => {
        mockGetOfframpQuote.mockResolvedValue({ data: { rate: '0.891', sourceAmount: '2244.56' } })

        const { result } = renderHook(() => useBridgeOfframpQuote({ currency: 'eur', destinationAmount: '2000.00' }), {
            wrapper,
        })

        await waitFor(() => expect(result.current.quote?.sourceAmount).toBe('2244.56'))
        expect(mockGetOfframpQuote).toHaveBeenCalledWith('eur', '2000.00')
    })

    it('does not ask for a USD amount', () => {
        renderHook(() => useBridgeOfframpQuote({ currency: null }), { wrapper })
        expect(mockGetOfframpQuote).not.toHaveBeenCalled()
    })

    it('a failed quote is an error, never a guessed amount', async () => {
        mockGetOfframpQuote.mockResolvedValue({ error: 'no rate' })

        const { result } = renderHook(() => useBridgeOfframpQuote({ currency: 'eur', destinationAmount: '2000.00' }), {
            wrapper,
        })

        await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 3000 })
        expect(result.current.quote).toBeNull()
    })

    it('a failed refresh keeps the last quote on screen and reports that it is not current', async () => {
        mockGetOfframpQuote.mockResolvedValueOnce({ data: { rate: '0.8955', sourceAmount: '2233.39' } })
        const { result } = renderHook(() => useBridgeOfframpQuote({ currency: 'eur', destinationAmount: '2000.00' }), {
            wrapper,
        })
        await waitFor(() => expect(result.current.quote?.sourceAmount).toBe('2233.39'))

        mockGetOfframpQuote.mockResolvedValue({ error: 'no rate' })
        await result.current.refetch()

        await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 3000 })
        expect(result.current.quote?.sourceAmount).toBe('2233.39')
    })
})
