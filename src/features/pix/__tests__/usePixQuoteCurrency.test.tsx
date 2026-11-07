/** @jest-environment jsdom */
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

jest.mock('@/hooks/useDebounce', () => ({ useDebounce: <T,>(value: T) => value }))
const mockQuote = jest.fn()
jest.mock('@/services/pix', () => ({ pixApi: { quote: (request: unknown) => mockQuote(request) } }))

import { usePixQuoteCurrency } from '../usePixQuoteCurrency'

describe('usePixQuoteCurrency', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
            {children}
        </QueryClientProvider>
    )
    beforeEach(() => jest.clearAllMocks())

    it("prices the amount on screen with the route provider's quote, not the /fx rate", async () => {
        mockQuote.mockResolvedValue({
            provider: 'avenia',
            operation: 'withdraw',
            amountBrl: '106.75',
            usdcAmount: '20.020325',
            rate: '5.369543',
            fixedFeeBrl: '0.75',
        })
        const { result } = renderHook(() => usePixQuoteCurrency('withdraw', '106.75', 20, true), { wrapper })

        await waitFor(() => expect(result.current.price).not.toBeNull())
        expect(mockQuote).toHaveBeenCalledWith({ operation: 'withdraw', amountBrl: '106.75' })
        expect(result.current.code).toBe('BRL')
        expect(result.current.price!.buy).toBe(result.current.price!.sell)
        expect(result.current.price!.sell * 20.020325).toBeCloseTo(106.75, 6)
    })

    it('prices the minimum before an amount is typed', async () => {
        mockQuote.mockResolvedValue({ amountBrl: '20', usdcAmount: '3.55', rate: '5.4', fixedFeeBrl: '0.75' })
        renderHook(() => usePixQuoteCurrency('deposit', undefined, 20, true), { wrapper })
        await waitFor(() => expect(mockQuote).toHaveBeenCalledWith({ operation: 'deposit', amountBrl: '20' }))
    })

    it('reports a failed quote, so the amount step offers a retry', async () => {
        mockQuote.mockRejectedValue(new Error('403'))
        const { result } = renderHook(() => usePixQuoteCurrency('deposit', '100', 20, true), { wrapper })
        await waitFor(() => expect(result.current.isError).toBe(true))
        expect(result.current.price).toBeNull()
    })

    it('asks for no quote while the amount step is not on screen', async () => {
        const { result } = renderHook(() => usePixQuoteCurrency('withdraw', '100', 20, false), { wrapper })
        await new Promise((resolve) => setTimeout(resolve, 0))
        expect(mockQuote).not.toHaveBeenCalled()
        expect(result.current.isLoading).toBe(false)
        expect(result.current.isError).toBe(false)
    })
})
