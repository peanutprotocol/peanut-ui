/** @jest-environment jsdom */
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

const mockDepositStatus = jest.fn()
jest.mock('@/services/avenia', () => ({ aveniaApi: { depositStatus: (id: string) => mockDepositStatus(id) } }))

import { useAveniaDepositStatus } from '../hooks/useAveniaDepositStatus'

describe('useAveniaDepositStatus', () => {
    let queryClient: QueryClient
    const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    beforeEach(() => {
        jest.clearAllMocks()
        queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    })

    it('reads nothing before there is a deposit', () => {
        const { result } = renderHook(() => useAveniaDepositStatus(undefined, jest.fn()), { wrapper })
        expect(result.current.phase).toBe('pending')
        expect(mockDepositStatus).not.toHaveBeenCalled()
    })

    it('fires onComplete once when the deposit completes', async () => {
        mockDepositStatus.mockResolvedValue({
            intentId: 'd1',
            status: 'COMPLETED',
            ticketStatus: 'PAID',
            expiresAt: null,
        })
        const onComplete = jest.fn()
        const { result, rerender } = renderHook(() => useAveniaDepositStatus('d1', onComplete), { wrapper })

        await waitFor(() => expect(result.current.phase).toBe('completed'))
        rerender()
        expect(onComplete).toHaveBeenCalledTimes(1)
        expect(mockDepositStatus).toHaveBeenCalledWith('d1')
    })

    it('reads a Pix Avenia sent back as returned, without completing', async () => {
        mockDepositStatus.mockResolvedValue({
            intentId: 'd2',
            status: 'FAILED',
            ticketStatus: 'FAILED',
            expiresAt: null,
        })
        const onComplete = jest.fn()
        const { result } = renderHook(() => useAveniaDepositStatus('d2', onComplete), { wrapper })

        await waitFor(() => expect(result.current.phase).toBe('returned'))
        expect(onComplete).not.toHaveBeenCalled()
    })

    it('reads a paid ticket as processing until the bridge completes it', async () => {
        mockDepositStatus.mockResolvedValue({
            intentId: 'd3',
            status: 'PROCESSING',
            ticketStatus: 'PAID',
            expiresAt: null,
        })
        const { result } = renderHook(() => useAveniaDepositStatus('d3', jest.fn()), { wrapper })
        await waitFor(() => expect(result.current.phase).toBe('processing'))
    })
})
