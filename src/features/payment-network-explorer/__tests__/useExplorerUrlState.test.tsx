import { act, renderHook } from '@testing-library/react'
import { NuqsTestingAdapter, type OnUrlUpdateFunction } from 'nuqs/adapters/testing'
import type { ReactNode } from 'react'
import { DEFAULT_TOP_NODES, defaultExplorerFilters } from '../query'
import { useExplorerUrlState } from '../useExplorerUrlState'

const wrapperFor = (searchParams: Record<string, string>, onUrlUpdate?: OnUrlUpdateFunction) =>
    function Wrapper({ children }: { children: ReactNode }) {
        return (
            <NuqsTestingAdapter searchParams={searchParams} onUrlUpdate={onUrlUpdate}>
                {children}
            </NuqsTestingAdapter>
        )
    }

describe('useExplorerUrlState', () => {
    it('falls back to the defaults on an empty URL', () => {
        const { result } = renderHook(() => useExplorerUrlState(), { wrapper: wrapperFor({}) })
        expect(result.current.filters).toEqual(defaultExplorerFilters())
    })

    it('reads the deep-link params, mapping dir and top to their filter names', () => {
        const { result } = renderHook(() => useExplorerUrlState(), {
            wrapper: wrapperFor({
                view: 'table',
                types: 'SEND_LINK,DIRECT_TRANSFER',
                dir: 'bidirectional',
                minCount: '3',
                minUsd: '50',
                top: '500',
                user: 'legacy_user.name-1',
            }),
        })
        expect(result.current.filters).toEqual({
            view: 'table',
            types: ['SEND_LINK', 'DIRECT_TRANSFER'],
            direction: 'bidirectional',
            minCount: 3,
            minUsd: 50,
            topNodes: 500,
            focus: 'legacy_user.name-1',
        })
    })

    it('rejects malformed params instead of forwarding them', () => {
        const { result } = renderHook(() => useExplorerUrlState(), {
            wrapper: wrapperFor({
                view: 'export',
                types: 'NOT_A_TYPE',
                dir: 'sideways',
                minCount: '-2',
                minUsd: 'NaN',
                top: '-1',
                user: 'a'.repeat(41),
            }),
        })
        expect(result.current.filters).toEqual(defaultExplorerFilters())
    })

    it('accepts an explicit top=0 as the all-users choice', () => {
        const { result } = renderHook(() => useExplorerUrlState(), { wrapper: wrapperFor({ top: '0' }) })
        expect(result.current.filters.topNodes).toBe(0)
    })

    it('rejects a token-shaped user value', () => {
        const { result } = renderHook(() => useExplorerUrlState(), {
            wrapper: wrapperFor({ user: 'not a username!' }),
        })
        expect(result.current.filters.focus).toBeNull()
    })

    it('serializes filter patches back onto the short param names', async () => {
        const onUrlUpdate = jest.fn()
        const { result } = renderHook(() => useExplorerUrlState(), { wrapper: wrapperFor({}, onUrlUpdate) })

        await act(async () => {
            await result.current.setFilters({ direction: 'oneWay', topNodes: 1000, focus: 'alice' })
        })

        const search = onUrlUpdate.mock.calls.at(-1)?.[0].searchParams as URLSearchParams
        expect(search.get('dir')).toBe('oneWay')
        expect(search.get('top')).toBe('1000')
        expect(search.get('user')).toBe('alice')
        expect(result.current.filters.topNodes).toBe(1000)
        expect(result.current.filters.topNodes).not.toBe(DEFAULT_TOP_NODES)
    })
})
