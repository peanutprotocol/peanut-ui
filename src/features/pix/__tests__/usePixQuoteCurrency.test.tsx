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
const OPENING = {
    amountBrl: '503.00',
    usdcAmount: '92.504310',
    rate: '5.445692',
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

    it("opens on the opening amount and takes the provider's minimum from that quote", async () => {
        mockQuote.mockResolvedValue(OPENING)
        const { result } = renderHook(() => usePixQuoteCurrency('withdraw', undefined, { spendUsd: '92.50' }, true), {
            wrapper,
        })

        await waitFor(() => expect(result.current.minimumBrl).toBe('20'))
        expect(mockQuote).toHaveBeenCalledTimes(1)
        expect(mockQuote).toHaveBeenCalledWith({ operation: 'withdraw', spendUsd: '92.50' })
        expect(result.current.price!.sell * 92.50431).toBeCloseTo(503, 4)
    })

    it('prices the reais on screen with their own quote once they reach the minimum, not the /fx rate', async () => {
        mockQuote.mockImplementation(async (request: { amountBrl?: string }) =>
            request.amountBrl === '106.75' ? TYPED : OPENING
        )
        const { result } = renderHook(() => usePixQuoteCurrency('withdraw', '106.75', { spendUsd: '92.50' }, true), {
            wrapper,
        })

        await waitFor(() => expect(mockQuote).toHaveBeenCalledWith({ operation: 'withdraw', amountBrl: '106.75' }))
        await waitFor(() => expect(result.current.price!.sell * 20.020325).toBeCloseTo(106.75, 6))
        expect(result.current.code).toBe('BRL')
        expect(result.current.price!.buy).toBe(result.current.price!.sell)
    })

    it('keeps the opening quote for an amount under the minimum', async () => {
        mockQuote.mockResolvedValue(OPENING)
        const { result } = renderHook(() => usePixQuoteCurrency('deposit', '10', { amountBrl: '20' }, true), {
            wrapper,
        })

        await waitFor(() => expect(result.current.price).not.toBeNull())
        expect(mockQuote).toHaveBeenCalledTimes(1)
        expect(mockQuote).toHaveBeenCalledWith({ operation: 'deposit', amountBrl: '20' })
    })

    it('reports a failed quote, so the amount step offers a retry', async () => {
        mockQuote.mockRejectedValue(new Error('403'))
        const { result } = renderHook(() => usePixQuoteCurrency('deposit', '100', { amountBrl: '20' }, true), {
            wrapper,
        })
        await waitFor(() => expect(result.current.isError).toBe(true))
        expect(result.current.price).toBeNull()
    })

    it('waits, never a field in USD, while there is nothing to open on yet', () => {
        const { result } = renderHook(() => usePixQuoteCurrency('deposit', undefined, null, true), { wrapper })
        expect(result.current.isLoading).toBe(true)
        expect(mockQuote).not.toHaveBeenCalled()
    })

    it('asks for no quote while the amount step is not on screen', async () => {
        const { result } = renderHook(() => usePixQuoteCurrency('withdraw', '100', { spendUsd: '92.50' }, false), {
            wrapper,
        })
        await new Promise((resolve) => setTimeout(resolve, 0))
        expect(mockQuote).not.toHaveBeenCalled()
        expect(result.current.isLoading).toBe(false)
        expect(result.current.isError).toBe(false)
    })
})
