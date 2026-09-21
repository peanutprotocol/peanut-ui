import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { useRequestPayAmounts } from '../useRequestPayAmounts'

const payAmounts = jest.fn()
jest.mock('@/services/requests', () => ({
    requestsApi: { payAmounts: (...args: unknown[]) => payAmounts(...args) },
}))

const PAY_AMOUNTS = {
    requestCurrency: 'EUR',
    requestAmount: '100.00',
    rails: [
        {
            kind: 'bank',
            railId: 'bridge.sepa_eu',
            payerAmount: { amount: '100.00', currency: 'EUR', isEstimate: false },
        },
    ],
}

const wrapper = ({ children }: { children: ReactNode }) => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

beforeEach(() => jest.clearAllMocks())

describe('useRequestPayAmounts', () => {
    it('returns the per-rail amounts', async () => {
        payAmounts.mockResolvedValue(PAY_AMOUNTS)

        const { result } = renderHook(() => useRequestPayAmounts('req-1'), { wrapper })

        await waitFor(() => expect(result.current.payAmounts).toEqual(PAY_AMOUNTS))
        expect(payAmounts).toHaveBeenCalledWith('req-1')
    })

    // The pay screen works with no per-rail amounts, so neither an older API
    // nor a failed read may surface as an error.
    it('reads an API without the route as "no amounts"', async () => {
        payAmounts.mockResolvedValue(null)

        const { result } = renderHook(() => useRequestPayAmounts('req-1'), { wrapper })

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.payAmounts).toBeUndefined()
    })

    it('reads a failed call as "no amounts"', async () => {
        payAmounts.mockRejectedValue(new Error('500'))

        const { result } = renderHook(() => useRequestPayAmounts('req-1'), { wrapper })

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.payAmounts).toBeUndefined()
    })

    it('asks nothing without a request id', () => {
        renderHook(() => useRequestPayAmounts(undefined), { wrapper })

        expect(payAmounts).not.toHaveBeenCalled()
    })
})
