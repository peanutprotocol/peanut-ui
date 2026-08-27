import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { collectLatestEntries, useTransactionHistory, type HistoryResponse } from '@/hooks/useTransactionHistory'
import type { HistoryEntry } from '@/hooks/useTransactionHistory'
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
 * until it has `limit` unique rows, the feed is exhausted, or the page cap is
 * hit (a pathological feed must not fetch unboundedly).
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

    it('the page cap holds when every page yields one new row', async () => {
        let n = 0
        const fetchPage = jest.fn(() => {
            n += 1
            return Promise.resolve({ entries: [row(`pot-${n}`)], cursor: `c${n}`, hasMore: true })
        })

        const result = await collectLatestEntries(fetchPage, 10, 4)

        expect(fetchPage).toHaveBeenCalledTimes(4)
        expect(result.entries).toHaveLength(4)
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
