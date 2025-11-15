import { useQuery } from '@tanstack/react-query'
import { erc20Abi } from 'viem'
import type { Address } from 'viem'
import { PEANUT_WALLET_TOKEN, peanutPublicClient } from '@/constants'

/**
 * Hook to fetch and auto-refresh wallet balance using TanStack Query
 *
 * ⚠️ NOTE: Service Worker CANNOT cache RPC POST requests
 * - Blockchain RPC calls use POST method (not cacheable by Cache Storage API)
 * - See: https://w3c.github.io/ServiceWorker/#cache-put (point 4)
 * - Future: Consider server-side proxy to enable SW caching
 *
 * Current caching strategy (in-memory only):
 * - TanStack Query caches balance for 30 seconds in memory
 * - Cache is lost on page refresh/reload
 * - Balance refetches from blockchain RPC on every app open
 *
 * Why staleTime: 30s:
 * - Balances data that's 30s old during active session
 * - Reduces RPC calls during navigation (balance displayed on multiple pages)
 * - Prevents rate limiting from RPC providers
 * - Balance still updates every 30s automatically
 *
 * Features:
 * - In-memory cache for 30s (fast during active session)
 * - Auto-refreshes every 30 seconds
 * - Built-in retry with exponential backoff
 * - Refetches on window focus and network reconnection
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
        staleTime: 30 * 1000, // Cache balance for 30s in memory (no SW caching for POST requests)
        gcTime: 5 * 60 * 1000, // Keep in memory for 5min
        refetchInterval: 30 * 1000, // Auto-refresh every 30 seconds
        refetchOnWindowFocus: true, // Refresh when tab regains focus
        refetchOnReconnect: true, // Refresh after network reconnection
        retry: 3, // Retry failed requests 3 times
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
    })
}
