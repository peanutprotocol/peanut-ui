import { TRANSACTIONS } from '@/constants/query.consts'
import { serverFetch } from '@/utils/api-fetch'
import type { InfiniteData, InfiniteQueryObserverResult, QueryObserverResult } from '@tanstack/react-query'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { completeHistoryEntry } from '@/utils/history.utils'
import type { HistoryEntry } from '@/utils/history.utils'
import { isDemoMode } from '@/utils/demo'
import { DEMO_HISTORY_ENTRIES } from '@/constants/demo-data'
import { getDemoTransactions } from '@/utils/demo-transactions'

//TODO: remove and import all from utils everywhere
export { EHistoryUserRole } from '@/utils/history.utils'
export type { HistoryEntry, HistoryEntryType, HistoryUserRole } from '@/utils/history.utils'

type LatestHistoryResult = QueryObserverResult<HistoryResponse>
type InfiniteHistoryResult = InfiniteQueryObserverResult<InfiniteData<HistoryResponse>>

export type HistoryResponse = {
    entries: HistoryEntry[]
    cursor?: string
    hasMore: boolean
}

// Hook options
type UseTransactionHistoryOptions = {
    mode?: 'infinite' | 'latest'
    limit?: number
    enabled?: boolean
    username?: string
    filterMutualTxs?: boolean
}

export function useTransactionHistory(options: {
    mode: 'latest'
    limit?: number
    enabled?: boolean
    username?: string
    filterMutualTxs?: boolean
}): LatestHistoryResult

export function useTransactionHistory(options: {
    mode?: 'infinite'
    limit?: number
    enabled?: boolean
}): InfiniteHistoryResult

/**
 * A flexible hook for fetching transaction history with two modes:
 * - 'infinite': For the main history page with infinite scrolling
 * - 'latest': For showing the most recent transactions on the home page
 */
export function useTransactionHistory({
    mode = 'infinite',
    limit = 50,
    enabled = true,
    username,
    filterMutualTxs,
}: UseTransactionHistoryOptions): LatestHistoryResult | InfiniteHistoryResult {
    const fetchHistory = async ({ cursor, limit }: { cursor?: string; limit: number }): Promise<HistoryResponse> => {
        // demo mode: transactions made this session (utils/demo-transactions.ts)
        // prepended to the static seed. Run through completeHistoryEntry (same as
        // real entries below) so amounts/links format correctly.
        if (isDemoMode()) {
            const all = [...getDemoTransactions(), ...DEMO_HISTORY_ENTRIES]
            const entries = await Promise.all(all.slice(0, limit).map(completeHistoryEntry))
            return { entries, hasMore: false }
        }

        const queryParams = new URLSearchParams()
        if (cursor) queryParams.append('cursor', cursor)
        if (limit) queryParams.append('limit', limit.toString())
        // append targetUsername to the query params if filterMutualTxs is true and username is provided
        if (filterMutualTxs && username) queryParams.append('targetUsername', username)

        // no-store: home Activity must never render a cached copy of history
        // (server also sends Cache-Control: no-store; this covers the WebView path)
        const response = await serverFetch(`/users/history?${queryParams.toString()}`, {
            method: 'GET',
            cache: 'no-store',
        })

        if (!response.ok) {
            throw new Error(`Failed to fetch history: ${response.statusText}`)
        }

        const data = await response.json()

        return {
            ...data,
            entries: await Promise.all(data.entries.map(completeHistoryEntry)),
        }
    }

    // Both hooks run unconditionally on every render (Rules of Hooks). The disabled one
    // sits idle thanks to its `enabled` flag — no network, no work — so this has no
    // runtime cost over the conditional version, while removing the hook-order corruption
    // that bites if a caller ever flips `mode` mid-life.

    // Latest transactions (home page).
    // Cached only in TQ memory (30s stale); the HTTP response is no-store end to end.
    const latestQuery = useQuery({
        queryKey: [TRANSACTIONS, 'latest', { limit, targetUsername: filterMutualTxs ? username : undefined }],
        queryFn: () => fetchHistory({ limit }),
        enabled: mode === 'latest' && enabled,
        staleTime: 30 * 1000,
        gcTime: 5 * 60 * 1000,
        refetchOnMount: true,
        refetchOnWindowFocus: true,
    })

    // Infinite scrolling (main history page).
    const infiniteQuery = useInfiniteQuery({
        queryKey: [TRANSACTIONS, 'infinite', { limit }],
        queryFn: ({ pageParam }) => fetchHistory({ cursor: pageParam, limit }),
        initialPageParam: undefined as string | undefined,
        getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.cursor : undefined),
        enabled: mode === 'infinite' && enabled,
        staleTime: 30 * 1000,
        gcTime: 5 * 60 * 1000,
    })

    return mode === 'latest' ? latestQuery : infiniteQuery
}
