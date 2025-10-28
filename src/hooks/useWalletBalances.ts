import { useQuery } from '@tanstack/react-query'
import { fetchWalletBalances } from '@/app/actions/tokens'
import type { IUserBalance } from '@/interfaces'

/**
 * Hook to fetch and cache external wallet balances using TanStack Query
 *
 * This replaces the manual useEffect + refs in TokenSelector.tsx with:
 * - Automatic caching (30s stale time)
 * - Automatic deduplication (same address = single request)
 * - Auto-refresh every 60 seconds
 * - Built-in retry logic
 * - Placeholder data to prevent UI flicker
 *
 * Features:
 * - Only fetches when address is provided (enabled guard)
 * - Auto-refreshes when user returns to tab
 * - Shows previous data while loading new data (smooth UX)
 * - Automatically clears when address becomes undefined
 *
 * @param address - External wallet address to fetch balances for (undefined = disabled)
 * @returns TanStack Query result with balances array
 */
export const useWalletBalances = (address: string | undefined) => {
    return useQuery({
        queryKey: ['walletBalances', address],
        queryFn: async (): Promise<IUserBalance[]> => {
            const result = await fetchWalletBalances(address!)
            return result.balances || []
        },
        enabled: !!address, // Only fetch if address exists (handles disconnect automatically)
        staleTime: 30 * 1000, // 30 seconds (balances can change frequently)
        gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
        refetchInterval: 60 * 1000, // Auto-refresh every 60 seconds
        refetchOnWindowFocus: true, // Refresh when user returns to tab
        retry: 2, // Retry failed requests twice
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000), // Exponential backoff, max 5s
        // Show previous data while loading new data (prevents UI flicker when address changes)
        placeholderData: (previousData) => previousData,
    })
}
