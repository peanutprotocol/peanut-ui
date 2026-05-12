import { renderHook } from '@testing-library/react'
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
})
