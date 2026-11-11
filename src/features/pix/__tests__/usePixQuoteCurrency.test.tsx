/** @jest-environment jsdom */
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

jest.mock('@/hooks/useDebounce', () => ({ useDebounce: <T,>(value: T) => value }))
const mockQuote = jest.fn()
jest.mock('@/services/pix', () => ({ pixApi: { quote: (request: unknown) => mockQuote(request) } }))

import { usePixQuoteCurrency } from '../usePixQuoteCurrency'

// PR B's withdraw example: R$106.75 out for 20.020325 USDC, the R$0.75 fee included
const TYPED = {
    amountBrl: '106.75',
    usdcAmount: '20.020325',
    rate: '5.369543',
    fixedFeeBrl: '0.75',
    minAmountBrl: '20',
}
const MINIMUM = {
    amountBrl: '20.00',
    usdcAmount: '3.556000',
    rate: '5.413948',
    fixedFeeBrl: '0.75',
    minAmountBrl: '20',
}

describe('usePixQuoteCurrency', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
            {children}
        </QueryClientProvider>
    )
    beforeEach(() => jest.clearAllMocks())

    it("prices the route's minimum before an amount is typed: no whole-balance quote, no eligibility read", async () => {
        mockQuote.mockResolvedValue(MINIMUM)
        const { result } = renderHook(() => usePixQuoteCurrency('withdraw', undefined, '20', true), { wrapper })

        await waitFor(() => expect(result.current.price).not.toBeNull())
        expect(mockQuote).toHaveBeenCalledTimes(1)
        expect(mockQuote).toHaveBeenCalledWith({ operation: 'withdraw', amountBrl: '20' })
        expect(result.current.price!.sell * 3.556).toBeCloseTo(20, 4)
    })

    it('prices the reais on screen with their own quote once they reach the minimum, not the /fx rate', async () => {
        mockQuote.mockImplementation(async (request: { amountBrl?: string }) =>
            request.amountBrl === '106.75' ? TYPED : MINIMUM
        )
        const { result } = renderHook(() => usePixQuoteCurrency('withdraw', '106.75', '20', true), { wrapper })

        await waitFor(() => expect(mockQuote).toHaveBeenCalledWith({ operation: 'withdraw', amountBrl: '106.75' }))
        await waitFor(() => expect(result.current.price!.sell * 20.020325).toBeCloseTo(106.75, 6))
        expect(result.current.code).toBe('BRL')
        expect(result.current.price!.buy).toBe(result.current.price!.sell)
    })

    it('never quotes an amount under the minimum: it keeps the price of the minimum', async () => {
        mockQuote.mockResolvedValue(MINIMUM)
        const { result } = renderHook(() => usePixQuoteCurrency('deposit', '10', '20', true), { wrapper })

        await waitFor(() => expect(result.current.price).not.toBeNull())
        expect(mockQuote).toHaveBeenCalledTimes(1)
        expect(mockQuote).toHaveBeenCalledWith({ operation: 'deposit', amountBrl: '20' })
    })

    it('reports a failed quote, so the amount step offers a retry', async () => {
        mockQuote.mockRejectedValue(new Error('503'))
        const { result } = renderHook(() => usePixQuoteCurrency('deposit', '100', '20', true), { wrapper })
        await waitFor(() => expect(result.current.isError).toBe(true))
        expect(result.current.price).toBeNull()
    })

    // the old two-query hook fell back to the opening price when the typed amount's quote failed
    it("never keeps an earlier price when the typed amount's quote fails: the step offers a retry", async () => {
        mockQuote.mockImplementation(async (request: { amountBrl?: string }) => {
            if (request.amountBrl === '106.75') throw new Error('503')
            return MINIMUM
        })
        const { result, rerender } = renderHook(
            ({ typed }: { typed: string | undefined }) => usePixQuoteCurrency('withdraw', typed, '20', true),
            { wrapper, initialProps: { typed: undefined as string | undefined } }
        )
        await waitFor(() => expect(result.current.price).not.toBeNull())

        rerender({ typed: '106.75' })

        await waitFor(() => expect(result.current.isError).toBe(true))
        expect(result.current.price).toBeNull()
    })

    it('asks for no quote while the amount step is not on screen', async () => {
        const { result } = renderHook(() => usePixQuoteCurrency('withdraw', '100', '20', false), { wrapper })
        await new Promise((resolve) => setTimeout(resolve, 0))
        expect(mockQuote).not.toHaveBeenCalled()
        expect(result.current.isLoading).toBe(false)
        expect(result.current.isError).toBe(false)
    })
})
