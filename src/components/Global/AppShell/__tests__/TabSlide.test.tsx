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
 */
import React from 'react'
import { render, screen } from '@testing-library/react'

const mockPathname = { current: '/home' }
jest.mock('next/navigation', () => ({ usePathname: () => mockPathname.current }))

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

    it('remounts once on a home -> card tab slide, and not again while it stays there', () => {
        const { rerender } = renderAt('/home')
        expect(mounts).toBe(1)

        mockPathname.current = '/card'
        rerender(
            <TabSlide>
                <CountMounts />
            </TabSlide>
        )
        expect(mounts).toBe(2)

        // a re-render with the route unchanged must not remount the page again
        rerender(
            <TabSlide>
                <CountMounts />
            </TabSlide>
        )
        expect(mounts).toBe(2)
    })
})
