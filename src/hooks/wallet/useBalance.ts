import { useQuery } from '@tanstack/react-query'
import { erc20Abi } from 'viem'
import type { Address } from 'viem'
import { PEANUT_WALLET_TOKEN, peanutPublicClient } from '@/constants'

/**
 * Hook to fetch and auto-refresh wallet balance using TanStack Query
 *
 * Cache-first strategy with background updates (instant load):
 * 1. TanStack tries to fetch (staleTime: 0)
 * 2. Service Worker intercepts RPC call with StaleWhileRevalidate
 * 3. SW returns cached balance instantly (<50ms)
 * 4. SW fetches fresh balance in background from blockchain RPC
 * 5. UI updates seamlessly when fresh balance arrives
 *
 * Why staleTime: 0:
 * - Always attempts refetch to trigger SW cache layer
 * - SW returns cached data instantly (no waiting)
 * - Fresh data loads in background and updates UI
 * - Prevents excessive RPC calls (SW handles deduplication)
 *
 * Cache layers:
 * - Service Worker: 5 minutes (balanceOf calls cached at HTTP level)
 * - TanStack Query: In-memory for 5min (fast subsequent renders)
 *
 * Features:
 * - Instant cached response on repeat visits (<50ms)
 * - Background refresh for accuracy
 * - Auto-refreshes every 30 seconds
 * - Built-in retry on failure
 */
export const useBalance = (address: Address | undefined) => {
    return useQuery({
        queryKey: ['balance', address],
        queryFn: async () => {
            const balance = await peanutPublicClient.readContract({
                address: PEANUT_WALLET_TOKEN,
                abi: erc20Abi,
                functionName: 'balanceOf',
                args: [address!], // Safe non-null assertion because enabled guards this
            })

            return balance
        },
        enabled: !!address, // Only run query if address exists
        staleTime: 0, // Always refetch to trigger SW cache-first (instant) + background update
        gcTime: 5 * 60 * 1000, // Keep in memory for 5min
        refetchInterval: 30 * 1000, // Auto-refresh every 30 seconds
        refetchOnWindowFocus: true, // Refresh when tab regains focus
        refetchOnReconnect: true, // Refresh after network reconnection
        retry: 3, // Retry failed requests 3 times
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
    })
}
