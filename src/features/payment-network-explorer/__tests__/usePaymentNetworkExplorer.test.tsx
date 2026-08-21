import { act, renderHook, waitFor } from '@testing-library/react'
import { fetchPaymentNetwork, PaymentNetworkApiError } from '../api'
import { usePaymentNetworkExplorer } from '../usePaymentNetworkExplorer'
import type { ExplorerGraphResponse } from '../types'

jest.mock('../api', () => {
    const actual = jest.requireActual('../api')
    return { ...actual, fetchPaymentNetwork: jest.fn() }
})

const data: ExplorerGraphResponse = {
    nodes: [],
    edges: [],
    p2pEdges: [],
    stats: { totalNodes: 0, totalEdges: 0, totalP2PEdges: 0, usersWithAccess: 0, orphans: 0 },
}

describe('usePaymentNetworkExplorer', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.mocked(fetchPaymentNetwork).mockResolvedValue(data)
    })

    it('does not read live data before a desktop request exists', () => {
        const { result } = renderHook(() => usePaymentNetworkExplorer(null))
        expect(result.current.status).toBe('idle')
        expect(fetchPaymentNetwork).not.toHaveBeenCalled()
    })

    it('loads the graph once per topNodes value', async () => {
        const { result, rerender } = renderHook(
            ({ topNodes }: { topNodes: number }) => usePaymentNetworkExplorer({ topNodes }),
            { initialProps: { topNodes: 5000 } }
        )
        await waitFor(() => expect(result.current.status).toBe('ready'))
        expect(result.current.data).toBe(data)
        expect(fetchPaymentNetwork).toHaveBeenCalledWith(5000, expect.any(AbortSignal))

        // A new request object with the same topNodes must not refetch.
        rerender({ topNodes: 5000 })
        await waitFor(() => expect(result.current.status).toBe('ready'))
        expect(fetchPaymentNetwork).toHaveBeenCalledTimes(1)

        rerender({ topNodes: 500 })
        await waitFor(() => expect(fetchPaymentNetwork).toHaveBeenCalledWith(500, expect.any(AbortSignal)))
    })

    it('fails closed into the forbidden state on 403', async () => {
        jest.mocked(fetchPaymentNetwork).mockRejectedValue(new PaymentNetworkApiError('forbidden', 403))
        const { result } = renderHook(() => usePaymentNetworkExplorer({ topNodes: 5000 }))
        await waitFor(() => expect(result.current.status).toBe('forbidden'))
        expect(result.current.data).toBeNull()
        expect(result.current.error?.status).toBe(403)
    })

    it('surfaces other failures as a retryable error without a retry storm', async () => {
        jest.mocked(fetchPaymentNetwork).mockRejectedValue(new PaymentNetworkApiError('down', 500))
        const { result } = renderHook(() => usePaymentNetworkExplorer({ topNodes: 5000 }))
        await waitFor(() => expect(result.current.status).toBe('error'))
        expect(fetchPaymentNetwork).toHaveBeenCalledTimes(1)

        jest.mocked(fetchPaymentNetwork).mockResolvedValue(data)
        act(() => result.current.reload())
        await waitFor(() => expect(result.current.status).toBe('ready'))
        expect(fetchPaymentNetwork).toHaveBeenCalledTimes(2)
    })

    it('wraps an unexpected failure in the typed error', async () => {
        jest.mocked(fetchPaymentNetwork).mockRejectedValue(new Error('boom'))
        const { result } = renderHook(() => usePaymentNetworkExplorer({ topNodes: 5000 }))
        await waitFor(() => expect(result.current.status).toBe('error'))
        expect(result.current.error?.status).toBe(503)
    })

    it('ignores a superseded in-flight response', async () => {
        let resolveFirst!: (value: ExplorerGraphResponse) => void
        jest.mocked(fetchPaymentNetwork).mockImplementationOnce(
            () =>
                new Promise((resolve) => {
                    resolveFirst = resolve
                })
        )
        const { result, rerender } = renderHook(
            ({ topNodes }: { topNodes: number }) => usePaymentNetworkExplorer({ topNodes }),
            { initialProps: { topNodes: 5000 } }
        )
        await waitFor(() => expect(fetchPaymentNetwork).toHaveBeenCalledTimes(1))

        rerender({ topNodes: 500 })
        act(() => resolveFirst({ ...data, stats: { ...data.stats, totalNodes: 999 } }))

        await waitFor(() => expect(result.current.status).toBe('ready'))
        expect(result.current.data?.stats.totalNodes).toBe(0)
        expect(fetchPaymentNetwork).toHaveBeenCalledTimes(2)
    })
})
