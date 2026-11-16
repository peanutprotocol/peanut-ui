/**
 * useOpenMantecaDeposit — reads the user's open (unpaid) deposit order so the
 * amount step can offer it back instead of creating a new one.
 */
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

const mockGetOpenDeposit = jest.fn()
jest.mock('@/services/manteca', () => ({
    mantecaApi: { getOpenDeposit: mockGetOpenDeposit },
}))

// must come after the jest.mock calls above
import { useOpenMantecaDeposit } from '../useOpenMantecaDeposit'

describe('useOpenMantecaDeposit', () => {
    let queryClient: QueryClient

    beforeEach(() => {
        queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
        mockGetOpenDeposit.mockReset()
    })

    const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    it('returns the open order for the currency', async () => {
        const order = { id: 'syn-1', stages: { '1': { asset: 'ARS', thresholdAmount: '5000.00' } } }
        mockGetOpenDeposit.mockResolvedValue({ data: order })
        const { result } = renderHook(() => useOpenMantecaDeposit('ARS', true), { wrapper })

        await waitFor(() => expect(result.current).toEqual(order))
        expect(mockGetOpenDeposit).toHaveBeenCalledWith('ARS')
    })

    it('returns null when there is no open order or the request fails', async () => {
        mockGetOpenDeposit.mockResolvedValueOnce({ data: null })
        const { result } = renderHook(() => useOpenMantecaDeposit('ARS', true), { wrapper })
        await waitFor(() => expect(mockGetOpenDeposit).toHaveBeenCalled())
        expect(result.current).toBeNull()

        queryClient.clear()
        mockGetOpenDeposit.mockResolvedValueOnce({ error: 'Failed' })
        const failed = renderHook(() => useOpenMantecaDeposit('ARS', true), { wrapper })
        await waitFor(() => expect(mockGetOpenDeposit).toHaveBeenCalledTimes(2))
        expect(failed.result.current).toBeNull()
    })

    it('never shows a cached order again while the lookup refreshes after leaving the amount step', async () => {
        const orderA = { id: 'syn-a', stages: { '1': { asset: 'ARS', thresholdAmount: '5000.00' } } }
        mockGetOpenDeposit.mockResolvedValueOnce({ data: orderA })
        const { result, rerender } = renderHook(({ enabled }) => useOpenMantecaDeposit('ARS', enabled), {
            wrapper,
            initialProps: { enabled: true },
        })
        await waitFor(() => expect(result.current).toEqual(orderA))

        // details step: the lookup is off and offers nothing
        rerender({ enabled: false })
        expect(result.current).toBeNull()

        // back on the amount step after A expired: hold the refresh open and check A never shows
        let settle: (value: { data: null }) => void = () => {}
        mockGetOpenDeposit.mockReturnValueOnce(new Promise((resolve) => (settle = resolve)))
        rerender({ enabled: true })
        expect(result.current).toBeNull()
        await waitFor(() => expect(mockGetOpenDeposit).toHaveBeenCalledTimes(2))
        expect(result.current).toBeNull()

        settle({ data: null })
        await waitFor(() => expect(mockGetOpenDeposit).toHaveBeenCalledTimes(2))
        expect(result.current).toBeNull()
    })

    it('does not ask while disabled', () => {
        renderHook(() => useOpenMantecaDeposit('ARS', false), { wrapper })
        expect(mockGetOpenDeposit).not.toHaveBeenCalled()
    })
})
