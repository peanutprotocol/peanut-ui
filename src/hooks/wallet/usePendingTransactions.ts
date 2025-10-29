import { useQueryClient } from '@tanstack/react-query'
import { BALANCE_DECREASE } from '@/constants/query.consts'

/**
 * Hook to check if any balance-decreasing transactions are currently pending
 *
 * This prevents race conditions in balance validation by checking TanStack Query's
 * mutation state directly, which updates synchronously when mutations start/end.
 *
 * Unlike React state (isLoading, loadingState), this has ZERO race condition risk
 * because TanStack Query tracks mutation lifecycle internally.
 *
 * Note: We do NOT auto-invalidate balance when transactions complete because:
 * 1. RPC nodes may be stale/cached immediately after transaction completion
 * 2. Optimistic updates already reflect the correct balance
 * 3. The 30s auto-refresh in useBalance will sync with RPC once it catches up
 * 4. Forcing immediate refetch can cause balance to go "backwards" (confusing UX)
 *
 * @returns {object} - { hasPendingTransactions, pendingCount }
 *
 * @example
 * ```typescript
 * const { hasPendingTransactions } = usePendingTransactions()
 *
 * useEffect(() => {
 *   // Skip balance validation if transaction is pending
 *   if (hasPendingTransactions) return
 *
 *   // ... validate balance
 * }, [balance, hasPendingTransactions])
 * ```
 */
export const usePendingTransactions = () => {
    const queryClient = useQueryClient()

    // Count all pending mutations with 'balance-decrease' key
    // This includes: sendMoney, createLink, withdrawals, payments, etc.
    const pendingCount = queryClient.isMutating({
        mutationKey: [BALANCE_DECREASE],
    })

    // @dev we could do this, but see comment above about why we don't
    // // When all transactions complete, immediately refresh balance
    // // This provides instant UI update instead of waiting for 30s auto-refresh
    // useEffect(() => {
    //     const previousCount = previousCountRef.current
    //     previousCountRef.current = pendingCount

    //     // If we went from pending (>0) to no pending (0), all transactions finished
    //     if (previousCount > 0 && pendingCount === 0) {
    //         console.log('[usePendingTransactions] All transactions completed, refreshing balance')
    //         queryClient.invalidateQueries({ queryKey: ['balance'] })
    //     }
    // }, [pendingCount, queryClient])

    return {
        /** True if any balance-decreasing operation is in progress */
        hasPendingTransactions: pendingCount > 0,
        /** Number of pending balance-decreasing operations */
        pendingCount,
    }
}
