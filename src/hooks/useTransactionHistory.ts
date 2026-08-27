import { TRANSACTIONS } from '@/constants/query.consts'
import { serverFetch } from '@/utils/api-fetch'
import type { InfiniteData, InfiniteQueryObserverResult, QueryObserverResult } from '@tanstack/react-query'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { completeHistoryEntry } from '@/utils/history.utils'
import type { HistoryEntry } from '@/utils/history.utils'
import { getTokenDetails } from '@/utils/general.utils'
import type { ChargeEntry } from '@/services/services.types'
import { formatUnits, type Address } from 'viem'
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

/** Absolute ceiling on requests per latest-mode load — the sole bounded-work
 *  safety net. A page that yields no NEW unique row is not a reason to stop:
 *  a pot with dozens of contributions collapses many consecutive pages into
 *  its own rollup uuid while each one still advances the cursor toward the
 *  older activity behind it. */
const MAX_LATEST_PAGES = 10

/** The API applies its limit to raw intents BEFORE the pot rollup, so asking
 *  for several intents per wanted row makes a page collapse to more unique
 *  rows. Capped at the API's own default page size. */
const LATEST_PAGE_SIZE_MULTIPLIER = 5
const MAX_LATEST_PAGE_SIZE = 50

export function latestPageSize(limit: number): number {
    return Math.min(Math.max(limit * LATEST_PAGE_SIZE_MULTIPLIER, limit), MAX_LATEST_PAGE_SIZE)
}

/**
 * A pot's collected total, summed from its deduplicated charge union.
 *
 * Mirrors the BE's authoritative rule (peanut-api-ts src/charge/collected.ts):
 * only SUCCESSFUL payments count; a paid charge contributes the sum of its
 * settled `paidAmountInRequestedToken` (base units of the REQUESTED token),
 * falling back to the requested `tokenAmount` when a paid charge has no
 * settled figure yet. Charges with no successful payment contribute nothing.
 *
 * Returns undefined when the sum can't be trusted: no charges shipped, or the
 * link's token isn't in the token list (the rollup's charge projection omits
 * tokenDecimals, so base units can't be scaled without it).
 */
function sumCollectedFromCharges(entry: HistoryEntry, charges: ChargeEntry[]): number | undefined {
    if (!charges.length || !entry.tokenAddress || !entry.chainId) return undefined
    const decimals = getTokenDetails({ tokenAddress: entry.tokenAddress as Address, chainId: entry.chainId })?.decimals
    if (decimals === undefined) return undefined

    let total = 0
    for (const charge of charges) {
        const successful = (charge.payments ?? []).filter((payment) => payment.status === 'SUCCESSFUL')
        if (!successful.length) continue
        let settled = 0n
        try {
            settled = successful.reduce((sum, p) => sum + BigInt(p.paidAmountInRequestedToken ?? 0), 0n)
        } catch {
            return undefined
        }
        total += settled > 0n ? Number(formatUnits(settled, decimals)) : Number(charge.tokenAmount || 0)
    }
    return total
}

/**
 * Merges two copies of the same request-pot rollup row.
 *
 * Every page holding any of a pot's charges re-emits the rollup under the link
 * uuid, and each copy aggregates ONLY its own page window (BE:
 * mapRequestLinkRollup over that page's potCharges) — so no single page's
 * precomputed `totalAmountCollected` is authoritative, and the windows can be
 * disjoint (page 1 sums $10, page 2 sums a different $2 of the same $12 goal).
 * Picking one page's figure loses the rest; adding them double-counts the
 * charges that repeat at a page boundary.
 *
 * Rule: union the `charges` by uuid and re-derive the total from that union,
 * take the later `timestamp`, and keep the earlier (page-0) copy for
 * everything else — the link-level fields (amount/goal, status, recipient) are
 * identical across copies, and page 0 is the freshest for a
 * websocket-prepended row. When no page shipped a charges array (or the token
 * is unknown) the re-derivation isn't possible, so the greater precomputed
 * page total is used instead; it also floors the re-derived value so a page
 * reporting more than its own charges account for can never lose ground.
 */
function mergeRepeatedEntry(existing: HistoryEntry, incoming: HistoryEntry): HistoryEntry {
    const chargesByUuid = new Map((existing.charges ?? []).map((c) => [c.uuid, c]))
    for (const charge of incoming.charges ?? []) {
        if (!chargesByUuid.has(charge.uuid)) chargesByUuid.set(charge.uuid, charge)
    }
    const charges = [...chargesByUuid.values()]

    const greatestPageTotal = Math.max(existing.totalAmountCollected ?? 0, incoming.totalAmountCollected ?? 0)
    const fromCharges = sumCollectedFromCharges(existing, charges)
    const newer = new Date(incoming.timestamp).getTime() > new Date(existing.timestamp).getTime()

    return {
        ...existing,
        timestamp: newer ? incoming.timestamp : existing.timestamp,
        totalAmountCollected: fromCharges !== undefined ? Math.max(fromCharges, greatestPageTotal) : greatestPageTotal,
        charges: charges.length ? charges : existing.charges,
    }
}

/**
 * Follows the history cursor until `limit` UNIQUE rows are collected, the
 * feed is exhausted, or the cursor stops advancing — with `maxPages` as the
 * bounded-work ceiling.
 *
 * Needed because the API applies its limit to raw transaction intents BEFORE
 * collapsing a request pot's contributions into one rollup row — a page whose
 * newest intents are all contributions to the same pot comes back as a single
 * row with hasMore:true, so one fetch (any fixed limit) can't guarantee the
 * requested number of distinct rows. A page that adds no new uuid is still
 * progress as long as its cursor advanced; only an unmoved cursor means the
 * window is stuck. `hasMore` is reported from the last page fetched, so a
 * caller can tell the ceiling stopped it short of an exhausted feed.
 */
export async function collectLatestEntries(
    fetchPage: (cursor?: string) => Promise<HistoryResponse>,
    limit: number,
    maxPages: number = MAX_LATEST_PAGES
): Promise<HistoryResponse> {
    const byUuid = new Map<string, HistoryEntry>()
    let cursor: string | undefined
    let hasMore = false

    for (let page = 0; page < maxPages; page++) {
        const res = await fetchPage(cursor)
        for (const entry of res.entries) {
            const existing = byUuid.get(entry.uuid)
            byUuid.set(entry.uuid, existing ? mergeRepeatedEntry(existing, entry) : entry)
        }
        hasMore = res.hasMore

        if (!hasMore || byUuid.size >= limit) break
        // an unchanged or missing cursor cannot advance the window — stop
        // instead of refetching the same page (mirrors getNextPageParam below)
        if (!res.cursor || res.cursor === cursor) break
        cursor = res.cursor
    }

    return { entries: [...byUuid.values()].slice(0, limit), cursor, hasMore }
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

    // Latest transactions (home page). Follows the cursor inside the queryFn
    // until `limit` unique rows are available (see collectLatestEntries) —
    // one page suffices for typical feeds, so this rarely refetches.
    // Cached only in TQ memory (30s stale); the HTTP response is no-store end to end.
    const latestQuery = useQuery({
        queryKey: [TRANSACTIONS, 'latest', { limit, targetUsername: filterMutualTxs ? username : undefined }],
        queryFn: () => collectLatestEntries((cursor) => fetchHistory({ cursor, limit: latestPageSize(limit) }), limit),
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
        getNextPageParam: (lastPage, _allPages, lastPageParam) => {
            if (!lastPage.hasMore) return undefined
            // A cursor that did not advance means the API is re-serving the
            // same window — `openRequestLinks` re-queries with no exclusion,
            // so a user with `limit`-many open request links gets an identical
            // page forever. Duplicate rows used to grow the list and push the
            // loader out of the viewport, which paced infinite scroll; now
            // that they are deduped the list stops growing, the loader stays
            // intersecting, and useInfiniteScroll rebuilds its observer on
            // every isFetchingNextPage flip — an unbounded auto-fetch loop.
            // Stopping is correct: an unchanged cursor yields no new rows.
            if (lastPage.cursor === lastPageParam) return undefined
            return lastPage.cursor
        },
        enabled: mode === 'infinite' && enabled,
        staleTime: 30 * 1000,
        gcTime: 5 * 60 * 1000,
    })

    return mode === 'latest' ? latestQuery : infiniteQuery
}
