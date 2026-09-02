/** @jest-environment jsdom */
/**
 * The slide's key may only change when a slide actually plays.
 *
 * `key` on the motion.div exists to replay framer-motion's `initial`. Keying it
 * on the pathname remounted the entire route subtree on every navigation — and
 * the app router deliberately preserves state across navigations that render the
 * same page component (a dynamic segment swap, a `router.replace` that rewrites
 * a segment mid-flow). Those remounts discard local state and re-fire every
 * mount effect, so the key has to be inert for them.
 *
 * On the one navigation it is NOT inert for — home↔card — the app router has
 * already swapped the subtree itself: LayoutRouter renders each segment's tree
 * under its own router cache key, so /home and /card unmount each other with or
 * without this key. The last block measures that rather than asserting it.
 */
import React from 'react'
import { render, screen } from '@testing-library/react'

const mockPathname = { current: '/home' }
jest.mock('next/navigation', () => ({ usePathname: () => mockPathname.current }))

const mockReduceMotion = { current: false }
const mockInitials: unknown[] = []
jest.mock('framer-motion', () => {
    const react = require('react')
    return {
        useReducedMotion: () => mockReduceMotion.current,
        motion: {
            div: ({
                children,
                className,
                initial,
            }: {
                children: React.ReactNode
                className?: string
                initial: unknown
            }) => {
                mockInitials.push(initial)
                return react.createElement('div', { className }, children)
            },
        },
    }
})

import { TabSlide } from '../TabSlide'

let mounts = 0
const CountMounts = () => {
    React.useEffect(() => {
        mounts += 1
    }, [])
    return <div>page</div>
}

const renderAt = (path: string) => {
    mockPathname.current = path
    return render(
        <TabSlide>
            <CountMounts />
        </TabSlide>
    )
}

beforeEach(() => {
    mounts = 0
    mockInitials.length = 0
    mockReduceMotion.current = false
})

describe('TabSlide remount behaviour', () => {
    it('keeps the subtree mounted across a same-component navigation', () => {
        const { rerender } = renderAt('/pay/alice')
        expect(mounts).toBe(1)

        mockPathname.current = '/pay/bob'
        rerender(
            <TabSlide>
                <CountMounts />
            </TabSlide>
        )

        expect(screen.getByText('page')).toBeInTheDocument()
        expect(mounts).toBe(1)
    })

    it('keeps the subtree mounted when navigating to a non-tab route', () => {
        const { rerender } = renderAt('/home')
        expect(mounts).toBe(1)

        mockPathname.current = '/history'
        rerender(
            <TabSlide>
                <CountMounts />
            </TabSlide>
        )

        expect(mounts).toBe(1)
    })

    it('keeps the subtree mounted when the route has not changed', () => {
        const { rerender } = renderAt('/card')
        rerender(
            <TabSlide>
                <CountMounts />
            </TabSlide>
        )

        expect(mounts).toBe(1)
    })

    it('replays initial only on a tab change, and never under reduced motion', () => {
        const { rerender } = renderAt('/home')
        const navigateTo = (path: string) => {
            mockPathname.current = path
            rerender(
                <TabSlide>
                    <CountMounts />
                </TabSlide>
            )
        }
        expect(mockInitials.at(-1)).toBe(false)

        navigateTo('/card')
        expect(mockInitials.at(-1)).toEqual({ x: 40, opacity: 0 })

        navigateTo('/home')
        expect(mockInitials.at(-1)).toEqual({ x: -40, opacity: 0 })

        navigateTo('/history')
        expect(mockInitials.at(-1)).toBe(false)

        mockReduceMotion.current = true
        navigateTo('/card')
        expect(mockInitials.at(-1)).toBe(false)
    })
})

/**
 * How the app router renders the slot TabSlide wraps: the active segment's tree
 * is keyed by its router cache key (next/dist/client/components/layout-router —
 * the TemplateContext.Provider child carries `stateKey` as its key), so a
 * home→card navigation hands TabSlide a differently-keyed child either way.
 */
const routeSubtree = (path: string) => <CountMounts key={path} />

/** TabSlide with the key mechanism removed — animate-only, one stable node. */
const KeylessSlide = ({ className, children }: { className?: string; children: React.ReactNode }) => (
    <div className={className}>{children}</div>
)

const countMountsAcross = (
    Wrapper: (props: { className?: string; children: React.ReactNode }) => React.ReactElement,
    paths: string[],
    subtree: (path: string) => React.ReactElement = routeSubtree
) => {
    mounts = 0
    mockPathname.current = paths[0]
    const { rerender, unmount } = render(<Wrapper>{subtree(paths[0])}</Wrapper>)
    for (const path of paths.slice(1)) {
        mockPathname.current = path
        rerender(<Wrapper>{subtree(path)}</Wrapper>)
    }
    unmount()
    return mounts
}

const TRIP = ['/home', '/card', '/home']

describe('what the key costs on the navigations it fires for', () => {
    it('adds no remount on home↔card, which the router already swaps by segment', () => {
        const withKey = countMountsAcross(TabSlide, TRIP)
        const withoutKey = countMountsAcross(KeylessSlide, TRIP)

        expect(withKey).toBe(withoutKey)
        // one mount per segment entered, both ways
        expect(withKey).toBe(TRIP.length)
    })

    // Same harness, a child the router would have preserved: the key does cost a
    // remount there, so the measurement above is a result and not a tautology.
    // It is also the evidence that the motion node itself remounts on a tab
    // change — which is the only thing that replays `initial`.
    it('does remount a child the router keeps identical across the tab change', () => {
        const stableSubtree = () => <CountMounts />
        const withKey = countMountsAcross(TabSlide, TRIP, stableSubtree)
        const withoutKey = countMountsAcross(KeylessSlide, TRIP, stableSubtree)

        expect(withKey).toBe(TRIP.length)
        expect(withoutKey).toBe(1)
    })
})
