/** @jest-environment jsdom */
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

// the settled value: the value itself, unless a test holds an older one (the debounce window)
let mockSettled: { value: unknown } | null = null
jest.mock('@/hooks/useDebounce', () => ({
    useDebounce: <T,>(value: T): T => (mockSettled ? (mockSettled.value as T) : value),
}))
const mockQuote = jest.fn()
jest.mock('@/services/pix', () => ({ pixApi: { quote: (request: unknown) => mockQuote(request) } }))

import { usePixQuoteCurrency } from '../usePixQuoteCurrency'

// PR B's withdraw example: R$106.75 out for 20.020325 USDC, the R$0.75 fee included
const TYPED = {
    amountBrl: '106.75',
    usdcAmount: '20.020325',
    rate: '5.369543',
    fixedFeeBrl: '0.75',
    minAmountBrl: '5',
}
// a withdrawal's minimum is R$5 (the owner's ruling of 15 Nov)
const WITHDRAW_MINIMUM = {
    amountBrl: '5.00',
    usdcAmount: '1.073000',
    rate: '5.358807',
    fixedFeeBrl: '0.75',
    minAmountBrl: '5',
}
// a deposit's stays R$20
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
    beforeEach(() => {
        jest.clearAllMocks()
        mockSettled = null
    })

    // Chip on ui#4106: with R$100 quoted, typing R$200 kept the R$100 fee on screen for the debounce
    it('stops naming the quote’s fee as the user’s as soon as the amount on screen changes', async () => {
        mockQuote.mockImplementation(async (request: { amountBrl?: string }) => ({
            ...TYPED,
            amountBrl: request.amountBrl,
            exchangeRate: '5.400000',
            providerFeeBrl: '1.36',
        }))
        const { result, rerender } = renderHook(
            ({ typed }: { typed: string }) => usePixQuoteCurrency('deposit', typed, '20', true),
            { wrapper, initialProps: { typed: '100' } }
        )
        await waitFor(() => expect(result.current.quotesTypedAmount).toBe(true))

        // R$200 typed, the debounce still holds R$100: the quote on screen is not this amount's
        mockSettled = { value: '100' }
        rerender({ typed: '200' })
        expect(result.current.rateAndFee).toEqual({ exchangeRate: 5.4, providerFeeBrl: '1.36' })
        expect(result.current.quotesTypedAmount).toBe(false)
    })

    // the rate row is the quote's exchangeRate; the field still converts with amount ÷ USDC
    // (R$5 ÷ 1.0118 = 4.94), and the fee is the user's only on the typed amount's quote
    it('names the quote’s rate and fee apart from the price the field converts with', async () => {
        mockQuote.mockImplementation(async (request: { amountBrl?: string }) =>
            request.amountBrl === '106.75'
                ? { ...TYPED, exchangeRate: '5.400000', providerFeeBrl: '1.36' }
                : { ...WITHDRAW_MINIMUM, usdcAmount: '1.011800', exchangeRate: '5.370000', providerFeeBrl: '0.43' }
        )
        const { result, rerender } = renderHook(
            ({ typed }: { typed?: string }) => usePixQuoteCurrency('withdraw', typed, '5', true),
            { wrapper, initialProps: { typed: undefined as string | undefined } }
        )
        await waitFor(() => expect(result.current.rateAndFee).toEqual({ exchangeRate: 5.37, providerFeeBrl: '0.43' }))
        expect(result.current.quotesTypedAmount).toBe(false)
        expect(result.current.price!.sell).toBeCloseTo(4.9417, 3)

        rerender({ typed: '106.75' })
        await waitFor(() => expect(result.current.quotesTypedAmount).toBe(true))
        expect(result.current.rateAndFee).toEqual({ exchangeRate: 5.4, providerFeeBrl: '1.36' })
        expect(result.current.price!.sell).toBeCloseTo(106.75 / 20.020325, 6)
    })

    it('has no rate and fee while the quote loads, and null when it sends neither', async () => {
        let answer!: (quote: unknown) => void
        mockQuote.mockReturnValue(new Promise((resolve) => (answer = resolve)))
        const { result } = renderHook(() => usePixQuoteCurrency('withdraw', undefined, '5', true), { wrapper })
        expect(result.current.rateAndFee).toBeUndefined()
        answer(WITHDRAW_MINIMUM)
        await waitFor(() => expect(result.current.rateAndFee).toBeNull())
    })

    it("prices the route's minimum before an amount is typed: no whole-balance quote, no eligibility read", async () => {
        mockQuote.mockResolvedValue(WITHDRAW_MINIMUM)
        const { result } = renderHook(() => usePixQuoteCurrency('withdraw', undefined, '5', true), { wrapper })

        await waitFor(() => expect(result.current.price).not.toBeNull())
        expect(mockQuote).toHaveBeenCalledTimes(1)
        expect(mockQuote).toHaveBeenCalledWith({ operation: 'withdraw', amountBrl: '5' })
        expect(result.current.price!.sell * 1.073).toBeCloseTo(5, 4)
    })

    it('prices the reais on screen with their own quote once they reach the minimum, not the /fx rate', async () => {
        mockQuote.mockImplementation(async (request: { amountBrl?: string }) =>
            request.amountBrl === '106.75' ? TYPED : WITHDRAW_MINIMUM
        )
        const { result } = renderHook(() => usePixQuoteCurrency('withdraw', '106.75', '5', true), { wrapper })

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
            return WITHDRAW_MINIMUM
        })
        const { result, rerender } = renderHook(
            ({ typed }: { typed: string | undefined }) => usePixQuoteCurrency('withdraw', typed, '5', true),
            { wrapper, initialProps: { typed: undefined as string | undefined } }
        )
        await waitFor(() => expect(result.current.price).not.toBeNull())

        rerender({ typed: '106.75' })

        await waitFor(() => expect(result.current.isError).toBe(true))
        expect(result.current.price).toBeNull()
    })

    it('asks for no quote while the amount step is not on screen', async () => {
        const { result } = renderHook(() => usePixQuoteCurrency('withdraw', '100', '5', false), { wrapper })
        await new Promise((resolve) => setTimeout(resolve, 0))
        expect(mockQuote).not.toHaveBeenCalled()
        expect(result.current.isLoading).toBe(false)
        expect(result.current.isError).toBe(false)
    })
})
