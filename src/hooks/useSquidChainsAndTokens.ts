import { useQuery } from '@tanstack/react-query'
import { getSquidChainsAndTokens } from '@/app/actions/squid'

/**
 * Hook to fetch and cache Squid chains and tokens configuration
 *
 * This data is static and rarely changes, so we cache it for one day.
 * This prevents redundant API calls on every component mount.
 *
 * @returns TanStack Query result with chains and tokens data
 *
 * @example
 * ```typescript
 * const { data: chainsAndTokens = {} } = useSquidChainsAndTokens()
 * ```
 */
export const useSquidChainsAndTokens = () => {
    return useQuery({
        queryKey: ['squidChainsAndTokens'],
        queryFn: getSquidChainsAndTokens,
        staleTime: 24 * 60 * 60 * 1000, // 1 day in milliseconds
        gcTime: 24 * 60 * 60 * 1000, // 1 day in milliseconds
        refetchOnWindowFocus: false, // Don't refetch on tab focus
        refetchOnMount: false, // Don't refetch on component remount
        refetchOnReconnect: false, // Don't refetch on network reconnect
    })
}
