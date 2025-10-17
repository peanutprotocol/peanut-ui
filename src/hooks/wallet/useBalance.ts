import { useQuery } from '@tanstack/react-query'
import { erc20Abi } from 'viem'
import type { Address } from 'viem'
import { PEANUT_WALLET_TOKEN, peanutPublicClient } from '@/constants'

/**
 * Hook to fetch and auto-refresh wallet balance using TanStack Query
 *
 * Features:
 * - Auto-refreshes every 30 seconds
 * - Refetches when window regains focus
 * - Refetches after network reconnection
 * - Built-in retry on failure
 * - Caching and deduplication
 */
export const useBalance = (address: Address | undefined) => {
    return useQuery({
        queryKey: ['balance', address],
        queryFn: async () => {
            if (!address) {
                // Return 0 instead of throwing to avoid error state on manual refetch
                return 0n
            }

            const balance = await peanutPublicClient.readContract({
                address: PEANUT_WALLET_TOKEN,
                abi: erc20Abi,
                functionName: 'balanceOf',
                args: [address],
            })

            return balance
        },
        enabled: !!address, // Only run query if address exists
        staleTime: 10 * 1000, // Consider data stale after 10 seconds
        refetchInterval: 30 * 1000, // Auto-refresh every 30 seconds
        refetchOnWindowFocus: true, // Refresh when tab regains focus
        refetchOnReconnect: true, // Refresh after network reconnection
        retry: 3, // Retry failed requests 3 times
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
    })
}
