/**
 * Cache-only reads for the Crisp support snapshot.
 *
 * `useCrispUserData` is mounted app-wide (SupportDrawer sits in the layout, for
 * guests too), so it must never *subscribe* to the queries it reports on:
 * calling `useWallet()` there would switch on a 30s RPC poll for every logged-in
 * user on every screen, and `useLimits()` / `useRainCardOverview()` would each
 * add a request per session. These readers take whatever is already in the
 * react-query cache — warm on every screen that renders a balance or Activity —
 * and return `undefined` when it isn't there. A missing value is reported as
 * unavailable, never as a zero.
 */

import type { QueryClient } from '@tanstack/react-query'
import type { InfiniteData } from '@tanstack/react-query'
import { LIMITS, TRANSACTIONS } from '@/constants/query.consts'
import { RAIN_CARD_OVERVIEW_QUERY_KEY } from '@/hooks/useRainCardOverview'
import { smartUsdcBalanceQueryOptions } from '@/hooks/wallet/useBalance'
import type { UserLimitsResponse } from '@/interfaces/interfaces'
import type { RainCardOverview } from '@/services/rain'
import type { HistoryResponse } from '@/hooks/useTransactionHistory'
import type { HistoryEntry } from '@/utils/history.utils'
import type { Address } from 'viem'

export function readCachedSmartBalance(client: QueryClient, address: string | undefined): bigint | undefined {
    if (!address) return undefined
    return client.getQueryData<bigint>(smartUsdcBalanceQueryOptions(address as Address).queryKey)
}

export function readCachedRainOverview(client: QueryClient, userId: string | undefined): RainCardOverview | undefined {
    if (!userId) return undefined
    return client.getQueryData<RainCardOverview>([RAIN_CARD_OVERVIEW_QUERY_KEY, userId])
}

export function readCachedLimits(client: QueryClient): UserLimitsResponse | undefined {
    return client.getQueryData<UserLimitsResponse>([LIMITS])
}

const isInfiniteData = (data: unknown): data is InfiniteData<HistoryResponse> =>
    !!data && typeof data === 'object' && Array.isArray((data as InfiniteData<HistoryResponse>).pages)

/**
 * The newest history entry across every cached history query.
 *
 * Scanned rather than read by key on purpose: the `latest` key carries its
 * `limit` and `targetUsername`, so the cache legitimately holds several
 * variants at once (home Activity at 5, the carousel at 50) and hardcoding one
 * of them would silently return nothing the day a caller changes its limit.
 */
export function readLatestHistoryEntry(client: QueryClient): HistoryEntry | undefined {
    const entries: HistoryEntry[] = []

    for (const query of client.getQueryCache().findAll({ queryKey: [TRANSACTIONS] })) {
        const data = query.state.data
        if (isInfiniteData(data)) {
            for (const page of data.pages) entries.push(...(page?.entries ?? []))
        } else if (data && typeof data === 'object') {
            entries.push(...((data as HistoryResponse).entries ?? []))
        }
    }

    return entries.reduce<HistoryEntry | undefined>((newest, entry) => {
        if (!entry?.timestamp) return newest
        if (!newest) return entry
        return new Date(entry.timestamp).getTime() > new Date(newest.timestamp).getTime() ? entry : newest
    }, undefined)
}
