/**
 * useMantecaDepositPolling — maps the BE intent status to a poll status and
 * fires onComplete exactly once on COMPLETED. Read-only: it never moves money,
 * it mirrors GET /manteca/deposit/:id/status so the QR screen can advance.
 */
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

const mockGetDepositStatus = jest.fn()
jest.mock('@/services/manteca', () => ({
    mantecaApi: { getDepositStatus: mockGetDepositStatus },
}))

// eslint-disable-next-line import/first -- must come after jest.mock
import { useMantecaDepositPolling } from '../useMantecaDepositPolling'

describe('useMantecaDepositPolling', () => {
    let queryClient: QueryClient

    beforeEach(() => {
        queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
        mockGetDepositStatus.mockReset()
    })

    const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    it('reports "pending" for a non-terminal status', async () => {
        mockGetDepositStatus.mockResolvedValue({ data: { id: 'dep-1', status: 'PENDING' } })
        const { result } = renderHook(() => useMantecaDepositPolling('dep-1', jest.fn()), { wrapper })

        await waitFor(() => expect(mockGetDepositStatus).toHaveBeenCalledWith('dep-1'))
        expect(result.current.status).toBe('pending')
    })

    it('reports "completed" and fires onComplete exactly once on COMPLETED', async () => {
        mockGetDepositStatus.mockResolvedValue({ data: { id: 'dep-2', status: 'COMPLETED' } })
        const onComplete = jest.fn()
        const { result, rerender } = renderHook(() => useMantecaDepositPolling('dep-2', onComplete), { wrapper })

        await waitFor(() => expect(result.current.status).toBe('completed'))
        rerender()
        rerender()
        expect(onComplete).toHaveBeenCalledTimes(1)
    })

    it('reports "failed" for a terminal failure status', async () => {
        mockGetDepositStatus.mockResolvedValue({ data: { id: 'dep-3', status: 'CANCELLED' } })
        const { result } = renderHook(() => useMantecaDepositPolling('dep-3', jest.fn()), { wrapper })

        await waitFor(() => expect(result.current.status).toBe('failed'))
    })

    it('reports "processing" for an intermediate settling status', async () => {
        mockGetDepositStatus.mockResolvedValue({ data: { id: 'dep-4', status: 'PROCESSING' } })
        const { result } = renderHook(() => useMantecaDepositPolling('dep-4', jest.fn()), { wrapper })

        await waitFor(() => expect(result.current.status).toBe('processing'))
    })

    it('does not query when depositId is undefined', () => {
        const { result } = renderHook(() => useMantecaDepositPolling(undefined, jest.fn()), { wrapper })

        expect(result.current.status).toBe('pending')
        expect(mockGetDepositStatus).not.toHaveBeenCalled()
    })
})
