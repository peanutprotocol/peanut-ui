'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { usePathname } from 'next/navigation'
import { useRef } from 'react'
import { TAB_SPRING, type TabSlideDirection, tabSlideDirection } from '@/components/Global/BottomNav/tab-order'

// how far the incoming page starts off-center. Small on purpose: the nav pill
// defers its own spring two frames past the route commit, and a long travel
// here would still be in flight when the pill lands.
const SLIDE_OFFSET_PX = 40

/**
 * Slides the page content sideways when the route moves between the home and
 * card tabs, in the direction the nav pill travels. Any other navigation, and
 * every navigation under prefers-reduced-motion, renders without motion.
 *
 * Renders the shell's centering wrapper itself so no layout node is added:
 * a transform on an extra ancestor would re-parent fixed descendants for the
 * duration of the slide.
 */
export const TabSlide = ({ className, children }: { className?: string; children: React.ReactNode }) => {
    const pathname = usePathname()
    const reduceMotion = useReducedMotion()
    /**
     * The key exists only to replay `initial`, so it may change ONLY when a
     * slide actually plays. Keying on the pathname remounted the whole route
     * subtree on every navigation, including the same-component ones the app
     * router would otherwise reconcile (a dynamic segment swap, a router.replace
     * mid-flow) — discarding their local state and re-firing every mount effect.
     *
     * Derived during render rather than in an effect: `initial` is read at mount,
     * so a direction computed after paint arrives too late. Storing the path
     * alongside the direction keeps both stable across a double render.
     */
    const slide = useRef<{ key: number; direction: TabSlideDirection | null; path: string | null }>({
        key: 0,
        direction: null,
        path: null,
    })
    if (slide.current.path !== pathname) {
        const direction = reduceMotion ? null : tabSlideDirection(slide.current.path, pathname)
        slide.current = {
            key: direction ? slide.current.key + 1 : slide.current.key,
            direction,
            path: pathname,
        }
    }
    const { key, direction } = slide.current

    return (
        <motion.div
            key={key}
            className={className}
            initial={direction ? { x: direction === 'left' ? SLIDE_OFFSET_PX : -SLIDE_OFFSET_PX, opacity: 0 } : false}
            animate={{ x: 0, opacity: 1 }}
            transition={TAB_SPRING}
        >
            {children}
        </motion.div>
    )
}
