import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useTransactionHistory } from '@/hooks/useTransactionHistory'
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
