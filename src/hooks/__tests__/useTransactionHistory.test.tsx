import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
    collectLatestEntries,
    latestPageSize,
    useTransactionHistory,
    type HistoryResponse,
} from '@/hooks/useTransactionHistory'
import type { HistoryEntry } from '@/hooks/useTransactionHistory'
import { EHistoryUserRole } from '@/utils/history.utils'
import { mapTransactionDataForDrawer } from '@/components/TransactionDetails/transactionTransformer'
import type { ReactNode } from 'react'

// Mock the network — these tests assert hook-order behaviour, not fetching.
jest.mock('@/utils/api-fetch', () => ({
    serverFetch: jest.fn(() =>
        Promise.resolve({
            ok: true,
            statusText: 'OK',
            json: () => Promise.resolve({ entries: [], hasMore: false }),
        })
    ),
}))

function makeWrapper() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
    const Wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )
    Wrapper.displayName = 'TestQueryClientWrapper'
    return Wrapper
}

describe('useTransactionHistory', () => {
    // Regression test for the Rules-of-Hooks violation: the hook previously
    // called useQuery OR useInfiniteQuery based on `mode`, so switching modes
    // between renders changed the hook order and crashed the component.
    it('switching mode between renders does not crash (hook order stable)', () => {
        const wrapper = makeWrapper()
        // The overload signatures require literal `mode`; narrow per branch so the
        // hook is called with a concrete mode each time. Pre-fix, this rerender
        // chain crashed React with "Rendered different hooks than during the previous render".
        const { rerender } = renderHook(
            ({ mode }: { mode: 'latest' | 'infinite' }) =>
                mode === 'latest'
                    ? useTransactionHistory({ mode: 'latest', enabled: false })
                    : useTransactionHistory({ mode: 'infinite', enabled: false }),
            { wrapper, initialProps: { mode: 'latest' as 'latest' | 'infinite' } }
        )

        expect(() => rerender({ mode: 'infinite' })).not.toThrow()
        expect(() => rerender({ mode: 'latest' })).not.toThrow()
    })

    it('returns the latest-mode query shape for mode="latest"', () => {
        const wrapper = makeWrapper()
        const { result } = renderHook(() => useTransactionHistory({ mode: 'latest', enabled: false }), { wrapper })
        // useQuery result — has data/isLoading but no fetchNextPage.
        expect(result.current).toHaveProperty('data')
        expect(result.current).not.toHaveProperty('fetchNextPage')
    })

    it('returns the infinite-mode query shape for mode="infinite"', () => {
        const wrapper = makeWrapper()
        const { result } = renderHook(() => useTransactionHistory({ mode: 'infinite', enabled: false }), { wrapper })
        // useInfiniteQuery result — exposes fetchNextPage.
        expect(result.current).toHaveProperty('fetchNextPage')
    })

    // The API re-serves the same window when a cursor cannot advance —
    // `openRequestLinks` is re-queried on every page with no exclusion, so a
    // user with `limit`-many open request links gets an identical page every
    // time. Duplicate rows used to grow the list and push the infinite-scroll
    // loader out of the viewport; deduping removed that pacing, so an
    // unchanged cursor would spin fetchNextPage in an unbounded loop.
    it('stops paginating when the cursor does not advance', async () => {
        const { serverFetch } = jest.requireMock('@/utils/api-fetch')
        serverFetch.mockImplementation(() =>
            Promise.resolve({
                ok: true,
                statusText: 'OK',
                // Same cursor forever, hasMore never goes false.
                json: () => Promise.resolve({ entries: [], cursor: 'STUCK::same', hasMore: true }),
            })
        )

        const wrapper = makeWrapper()
        const { result } = renderHook(() => useTransactionHistory({ mode: 'infinite', limit: 20 }), { wrapper })

        await waitFor(() => expect(result.current.data?.pages).toHaveLength(1))
        // First page still advances: the initial param is undefined, so the
        // cursor is new information.
        expect(result.current.hasNextPage).toBe(true)

        await act(async () => {
            await result.current.fetchNextPage()
        })

        // Second page came back with the same cursor it was asked for, so
        // pagination stops instead of looping.
        await waitFor(() => expect(result.current.hasNextPage).toBe(false))
        expect(result.current.data?.pages).toHaveLength(2)
    })
})

/**
 * The API applies its limit to raw intents BEFORE collapsing a request pot's
 * contributions into one rollup row, so a page can hold far fewer unique rows
 * than asked for — in the extreme, one. Latest mode must follow the cursor
 * until it has `limit` unique rows, the feed is exhausted, or the pages stop
 * yielding anything new (a pathological feed must not fetch unboundedly).
 */
describe('collectLatestEntries', () => {
    const row = (uuid: string): HistoryEntry => ({ uuid, timestamp: new Date('2026-08-01') }) as HistoryEntry

    const pageSequence = (pages: HistoryResponse[]) => {
        let call = 0
        return jest.fn((cursor?: string): Promise<HistoryResponse> => {
            void cursor
            const page = pages[Math.min(call, pages.length - 1)]
            call += 1
            return Promise.resolve(page)
        })
    }

    it('keeps fetching past a page that collapsed into one rollup row until `limit` unique rows', async () => {
        const fetchPage = pageSequence([
            // 20 newest intents were all contributions to pot-1 → one row
            { entries: [row('pot-1')], cursor: 'c1', hasMore: true },
            // rollup repeats at the page boundary; dedupe keeps the first copy
            { entries: [row('pot-1'), row('a'), row('b'), row('c'), row('d')], cursor: 'c2', hasMore: true },
        ])

        const result = await collectLatestEntries(fetchPage, 5)

        expect(fetchPage).toHaveBeenCalledTimes(2)
        expect(fetchPage).toHaveBeenNthCalledWith(1, undefined)
        expect(fetchPage).toHaveBeenNthCalledWith(2, 'c1')
        expect(result.entries.map((e) => e.uuid)).toEqual(['pot-1', 'a', 'b', 'c', 'd'])
        // 5 unique rows reached — the c2 cursor is NOT followed
    })

    it('stops early when the feed is exhausted before `limit` rows', async () => {
        const fetchPage = pageSequence([{ entries: [row('a'), row('b')], hasMore: false }])

        const result = await collectLatestEntries(fetchPage, 5)

        expect(fetchPage).toHaveBeenCalledTimes(1)
        expect(result.entries.map((e) => e.uuid)).toEqual(['a', 'b'])
        expect(result.hasMore).toBe(false)
    })

    // A cursor-advancing page is progress even when it yields no new unique
    // row: a pot owning dozens of the newest intents collapses many
    // consecutive pages into its own uuid while the window still marches
    // toward the older activity behind it. Stopping on "no new rows" hid it.
    it('pages past a pot that swallows several consecutive pages, then reaches the older rows', async () => {
        const fetchPage = pageSequence([
            { entries: [row('pot-1')], cursor: 'c1', hasMore: true },
            { entries: [row('pot-1')], cursor: 'c2', hasMore: true },
            { entries: [row('pot-1')], cursor: 'c3', hasMore: true },
            { entries: [row('pot-1')], cursor: 'c4', hasMore: true },
            // window finally clears the pot: the older transactions appear
            { entries: [row('pot-1'), row('a'), row('b'), row('c'), row('d')], cursor: 'c5', hasMore: true },
        ])

        const result = await collectLatestEntries(fetchPage, 5)

        expect(fetchPage).toHaveBeenCalledTimes(5)
        expect(result.entries.map((e) => e.uuid)).toEqual(['pot-1', 'a', 'b', 'c', 'd'])
    })

    it('the absolute page ceiling bounds a pathological feed and reports hasMore honestly', async () => {
        let n = 0
        const fetchPage = jest.fn((): Promise<HistoryResponse> => {
            n += 1
            // never exhausts, never repeats a cursor, never fills `limit`
            return Promise.resolve({ entries: [row('pot-1')], cursor: `c${n}`, hasMore: true })
        })

        const result = await collectLatestEntries(fetchPage, 5, 10)

        expect(fetchPage).toHaveBeenCalledTimes(10)
        expect(result.entries.map((e) => e.uuid)).toEqual(['pot-1'])
        // the feed was NOT exhausted — the ceiling stopped us
        expect(result.hasMore).toBe(true)
    })

    it('the ceiling also bounds a feed that trickles one new row per page', async () => {
        let n = 0
        const fetchPage = jest.fn(() => {
            n += 1
            return Promise.resolve({ entries: [row(`pot-${n}`)], cursor: `c${n}`, hasMore: true })
        })

        const result = await collectLatestEntries(fetchPage, 100, 10)

        expect(fetchPage).toHaveBeenCalledTimes(10)
        expect(result.entries).toHaveLength(10)
        expect(result.hasMore).toBe(true)
    })

    it('stops when the cursor does not advance (identical re-served page)', async () => {
        const fetchPage = jest.fn(() => Promise.resolve({ entries: [row('a')], cursor: 'STUCK::same', hasMore: true }))

        await collectLatestEntries(fetchPage, 5)

        // first page: undefined → STUCK advances; second page returns the same
        // cursor it was asked for → stop
        expect(fetchPage).toHaveBeenCalledTimes(2)
    })

    it('caps the collected list at `limit` when the last page overshoots', async () => {
        const fetchPage = pageSequence([
            { entries: [row('pot-1')], cursor: 'c1', hasMore: true },
            { entries: ['a', 'b', 'c', 'd', 'e', 'f'].map(row), cursor: 'c2', hasMore: true },
        ])

        const result = await collectLatestEntries(fetchPage, 5)

        expect(result.entries).toHaveLength(5)
    })
})

/**
 * Each page's rollup aggregates only its own charge window, so the repeated
 * copies carry PARTIAL totals — and the windows can be DISJOINT ($10 on one
 * page, a different $2 on the next, of the same $12 goal). Picking any single
 * page's precomputed figure leaves a fully-paid request reading "collected <
 * goal", which the transformer renders with the pending hourglass. The total
 * is re-derived from the deduplicated charge union instead, mirroring the BE
 * rule in peanut-api-ts src/charge/collected.ts.
 */
describe('collectLatestEntries — request-pot rollup merge across pages', () => {
    // Arbitrum USDC (6 decimals) — the rollup's charge projection omits
    // tokenDecimals, so the sum resolves them from the entry's token.
    const USDC_ARBITRUM = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831'
    const baseUnits = (dollars: string) => BigInt(Math.round(Number(dollars) * 1e6)).toString()

    const charge = (uuid: string, dollars: string, status = 'SUCCESSFUL') => ({
        uuid,
        tokenAmount: dollars,
        payments: [{ uuid: `${uuid}-p`, status, paidAmountInRequestedToken: baseUnits(dollars) }],
        fulfillmentPayment: null,
    })

    const potRow = (
        collected: number,
        opts: { timestamp?: string; charges?: ReturnType<typeof charge>[] } = {}
    ): HistoryEntry =>
        ({
            uuid: 'pot-1',
            amount: '12',
            status: 'OPEN',
            isRequestLink: true,
            chainId: '42161',
            tokenAddress: USDC_ARBITRUM,
            tokenSymbol: 'USDC',
            timestamp: new Date(opts.timestamp ?? '2026-08-01T00:00:00Z'),
            totalAmountCollected: collected,
            ...(opts.charges ? { charges: opts.charges } : {}),
        }) as unknown as HistoryEntry

    const twoPages = (first: HistoryEntry, second: HistoryEntry) =>
        jest.fn(
            (cursor?: string): Promise<HistoryResponse> =>
                Promise.resolve(
                    cursor ? { entries: [second], hasMore: false } : { entries: [first], cursor: 'c1', hasMore: true }
                )
        )

    it('DISJOINT windows sum to the full total ($10 + $2 of a $12 goal)', async () => {
        const fetchPage = twoPages(
            potRow(10, { charges: [charge('ch-1', '10')] }),
            potRow(2, { charges: [charge('ch-2', '2')] })
        )

        const result = await collectLatestEntries(fetchPage, 5)

        // max-of-precomputed would have kept $10 and left the pot pending
        expect(result.entries[0].totalAmountCollected).toBe(12)
    })

    it('OVERLAPPING windows do not double-count the repeated charge', async () => {
        const fetchPage = twoPages(
            potRow(10, { charges: [charge('ch-1', '10')] }),
            potRow(12, { charges: [charge('ch-1', '10'), charge('ch-2', '2')] })
        )

        const result = await collectLatestEntries(fetchPage, 5)

        expect(result.entries[0].totalAmountCollected).toBe(12)
        expect(result.entries[0].charges?.map((c) => c.uuid)).toEqual(['ch-1', 'ch-2'])
    })

    it('excludes charges whose payments are not SUCCESSFUL, like the BE does', async () => {
        const fetchPage = twoPages(
            potRow(10, { charges: [charge('ch-1', '10')] }),
            potRow(0, { charges: [charge('ch-failed', '5', 'FAILED')] })
        )

        const result = await collectLatestEntries(fetchPage, 5)

        expect(result.entries[0].totalAmountCollected).toBe(10)
    })

    it('falls back to the greater precomputed total when no page ships charges', async () => {
        const fetchPage = twoPages(potRow(10), potRow(12))

        const result = await collectLatestEntries(fetchPage, 5)

        expect(result.entries[0].totalAmountCollected).toBe(12)
    })

    it('never regresses a fuller first-page total to a later partial one', async () => {
        const fetchPage = twoPages(potRow(12), potRow(3))

        const result = await collectLatestEntries(fetchPage, 5)

        expect(result.entries[0].totalAmountCollected).toBe(12)
    })

    it('keeps the later timestamp across merged copies', async () => {
        const fetchPage = twoPages(
            potRow(10, { timestamp: '2026-08-03T00:00:00Z', charges: [charge('ch-1', '10')] }),
            potRow(2, { timestamp: '2026-08-05T00:00:00Z', charges: [charge('ch-2', '2')] })
        )

        const result = await collectLatestEntries(fetchPage, 5)

        expect(new Date(result.entries[0].timestamp).toISOString()).toBe('2026-08-05T00:00:00.000Z')
    })

    it('the merged disjoint row maps to completed — a fully-paid pot loses the hourglass', async () => {
        const fetchPage = twoPages(
            potRow(10, { charges: [charge('ch-1', '10')] }),
            potRow(2, { charges: [charge('ch-2', '2')] })
        )

        const { entries } = await collectLatestEntries(fetchPage, 5)
        const merged = {
            ...entries[0],
            userRole: EHistoryUserRole.RECIPIENT,
            extraData: { kind: 'P2P_REQUEST_FULFILL' },
        } as HistoryEntry

        // pre-merge, the stale $10-of-$12 copy rendered 'pending'
        expect(mapTransactionDataForDrawer(merged).transactionDetails.status).toBe('completed')
    })
})

// The API limit counts raw intents, pre-rollup, so latest mode asks for
// several intents per wanted row — a bigger page collapses to more unique rows.
describe('latestPageSize', () => {
    it('over-requests intents per wanted row, capped at the API page size', () => {
        expect(latestPageSize(5)).toBe(25)
        expect(latestPageSize(10)).toBe(50)
        expect(latestPageSize(50)).toBe(50)
        // never asks for fewer rows than the caller wants
        expect(latestPageSize(80)).toBeGreaterThanOrEqual(50)
    })
})

describe('useTransactionHistory latest mode follows the cursor for short pages', () => {
    it('loads `limit` unique rows across pages in one query result', async () => {
        const historyRow = (uuid: string) => ({
            uuid,
            amount: '1',
            timestamp: '2026-08-01T00:00:00Z',
            tokenSymbol: 'USDC',
        })
        const { serverFetch } = jest.requireMock('@/utils/api-fetch')
        serverFetch.mockClear()
        serverFetch.mockImplementation((url: string) =>
            Promise.resolve({
                ok: true,
                statusText: 'OK',
                json: () =>
                    Promise.resolve(
                        url.includes('cursor=')
                            ? { entries: ['pot-1', 'a', 'b', 'c', 'd'].map(historyRow), hasMore: false }
                            : { entries: [historyRow('pot-1')], cursor: 'c1', hasMore: true }
                    ),
            })
        )

        const wrapper = makeWrapper()
        const { result } = renderHook(() => useTransactionHistory({ mode: 'latest', limit: 5 }), { wrapper })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(serverFetch).toHaveBeenCalledTimes(2)
        expect(result.current.data?.entries.map((e) => e.uuid)).toEqual(['pot-1', 'a', 'b', 'c', 'd'])
    })
})
