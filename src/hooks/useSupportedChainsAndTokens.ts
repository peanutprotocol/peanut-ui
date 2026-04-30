import { useQuery } from '@tanstack/react-query'
import { getSupportedChainsAndTokens } from '@/app/actions/supported-chains'

/**
 * Hook to fetch and cache supported chains and tokens configuration.
 *
 * Sourced locally (no live API call); cached for 24h since the data is static.
 *
 * @returns TanStack Query result with chains and tokens data
 *
 * @example
 * ```typescript
 * const { data: chainsAndTokens = {} } = useSupportedChainsAndTokens()
 * ```
 */
export const useSupportedChainsAndTokens = () => {
    return useQuery({
        queryKey: ['supportedChainsAndTokens'],
        queryFn: getSupportedChainsAndTokens,
        staleTime: 24 * 60 * 60 * 1000, // 1 day in milliseconds
        gcTime: 24 * 60 * 60 * 1000, // 1 day in milliseconds
        refetchOnWindowFocus: false, // Don't refetch on tab focus
        refetchOnMount: false, // Don't refetch on component remount
        refetchOnReconnect: false, // Don't refetch on network reconnect
    })
}
