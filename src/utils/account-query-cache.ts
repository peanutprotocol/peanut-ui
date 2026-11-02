import type { QueryClient } from '@tanstack/react-query'
import { USER } from '@/constants/query.consts'

/** Private reads must not outlive an ended session or follow a different login. */
export function clearAccountQueries(queryClient: QueryClient): void {
    const filters = { predicate: (query: { queryKey: readonly unknown[] }) => query.queryKey[0] !== USER }
    // Cancellation prevents an old in-flight read from repopulating the cache.
    void queryClient.cancelQueries(filters)
    queryClient.removeQueries(filters)
}
