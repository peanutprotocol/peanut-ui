import { PEANUT_API_URL } from '@/constants'
import { TRANSACTIONS } from '@/constants/query.consts'
import { fetchWithSentry } from '@/utils'
import type { InfiniteData, InfiniteQueryObserverResult, QueryObserverResult } from '@tanstack/react-query'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import Cookies from 'js-cookie'
import { completeHistoryEntry } from '@/utils/history.utils'
import type { HistoryEntry } from '@/utils/history.utils'

//TODO: remove and import all from utils everywhere
export { EHistoryEntryType, EHistoryUserRole } from '@/utils/history.utils'
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
        const queryParams = new URLSearchParams()
        if (cursor) queryParams.append('cursor', cursor)
        if (limit) queryParams.append('limit', limit.toString())
        // append targetUsername to the query params if filterMutualTxs is true and username is provided
        if (filterMutualTxs && username) queryParams.append('targetUsername', username)

        const url = `${PEANUT_API_URL}/users/history?${queryParams.toString()}`

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        }
        headers['Authorization'] = `Bearer ${Cookies.get('jwt-token')}`
        const response = await fetchWithSentry(url, { method: 'GET', headers })

        if (!response.ok) {
            throw new Error(`Failed to fetch history: ${response.statusText}`)
        }

        const data = await response.json()

        return {
            ...data,
            entries: await Promise.all(data.entries.map(completeHistoryEntry)),
        }
    }

    // Latest transactions mode (for home page)
    if (mode === 'latest') {
        // if filterMutualTxs is true, we need to add the username to the query key to invalidate the query when the username changes
        const queryKeyTxn = TRANSACTIONS + (filterMutualTxs ? username : '')
        return useQuery({
            queryKey: [queryKeyTxn, 'latest', { limit }],
            queryFn: () => fetchHistory({ limit }),
            enabled,
            staleTime: 5 * 60 * 1000, // 5 minutes
        })
    }

    // Infinite query mode (for main history page)
    return useInfiniteQuery({
        queryKey: [TRANSACTIONS, 'infinite', { limit }],
        queryFn: ({ pageParam }) => fetchHistory({ cursor: pageParam, limit }),
        initialPageParam: undefined as string | undefined,
        getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.cursor : undefined),
        enabled,
        staleTime: 5 * 60 * 1000, // 5 minutes
    })
}
