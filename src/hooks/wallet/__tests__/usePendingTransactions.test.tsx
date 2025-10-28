import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { usePendingTransactions } from '../usePendingTransactions'
import { BALANCE_DECREASE } from '@/constants/query.consts'
import type { ReactNode } from 'react'

/**
 * Tests for usePendingTransactions
 *
 * These tests verify the hook correctly tracks mutations using queryClient.isMutating()
 *
 * Note: We test the hook's integration with TanStack Query's mutation tracking system.
 * The actual mutation behavior is tested in the individual mutation hook tests.
 */

describe('usePendingTransactions', () => {
    let queryClient: QueryClient

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
                mutations: { retry: false },
            },
        })
    })

    afterEach(() => {
        queryClient.clear()
    })

    const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    it('should return false when no mutations are pending', () => {
        const { result } = renderHook(() => usePendingTransactions(), { wrapper })

        expect(result.current.hasPendingTransactions).toBe(false)
        expect(result.current.pendingCount).toBe(0)
    })

    it('should use queryClient.isMutating with BALANCE_DECREASE key', () => {
        const isMutatingSpy = jest.spyOn(queryClient, 'isMutating')
        const { result } = renderHook(() => usePendingTransactions(), { wrapper })

        // Accessing the property should trigger isMutating call
        const _ = result.current.hasPendingTransactions

        expect(isMutatingSpy).toHaveBeenCalledWith({
            mutationKey: [BALANCE_DECREASE],
        })
    })

    it('should return hasPendingTransactions=true when pendingCount > 0', () => {
        // Mock isMutating to return 2
        jest.spyOn(queryClient, 'isMutating').mockReturnValue(2)

        const { result } = renderHook(() => usePendingTransactions(), { wrapper })

        expect(result.current.pendingCount).toBe(2)
        expect(result.current.hasPendingTransactions).toBe(true)
    })

    it('should return hasPendingTransactions=false when pendingCount = 0', () => {
        // Mock isMutating to return 0
        jest.spyOn(queryClient, 'isMutating').mockReturnValue(0)

        const { result } = renderHook(() => usePendingTransactions(), { wrapper })

        expect(result.current.pendingCount).toBe(0)
        expect(result.current.hasPendingTransactions).toBe(false)
    })

    it('should track only BALANCE_DECREASE mutations', () => {
        const isMutatingSpy = jest.spyOn(queryClient, 'isMutating')
        renderHook(() => usePendingTransactions(), { wrapper })

        // Verify it filters by the correct mutation key
        expect(isMutatingSpy).toHaveBeenCalledWith({
            mutationKey: [BALANCE_DECREASE],
        })

        // Verify it doesn't track all mutations
        expect(isMutatingSpy).not.toHaveBeenCalledWith({})
    })
})
