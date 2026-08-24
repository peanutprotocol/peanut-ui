import { QueryClient } from '@tanstack/react-query'
import { RETRY_STRATEGIES } from '@/utils/retry.utils'

// Shared by every route. Lives here rather than in wagmi.config so the
// marketing site can mount a query client without pulling in wagmi.
export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            ...RETRY_STRATEGIES.FAST,
            staleTime: 30 * 1000, // Cache data as fresh for 30s
            gcTime: 5 * 60 * 1000, // Keep inactive queries in memory for 5min
            refetchOnWindowFocus: true, // Refetch stale data when user returns
            refetchOnReconnect: true, // Refetch when connectivity restored
            // Allow queries when offline to read from TanStack Query in-memory cache
            networkMode: 'always', // Run queries even when offline (reads from cache)
        },
        mutations: {
            retry: 1, // Total 2 attempts: immediate + 1 retry (conservative for write operations)
            retryDelay: 1000, // Fixed 1s delay
            networkMode: 'online', // Pause mutations while offline (writes require network)
        },
    },
})
