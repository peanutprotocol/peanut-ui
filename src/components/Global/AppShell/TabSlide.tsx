'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { TAB_SPRING, tabSlideDirection } from '@/components/Global/BottomNav/tab-order'

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
    const previous = useRef<string | null>(null)
    const direction = reduceMotion ? null : tabSlideDirection(previous.current, pathname)

    useEffect(() => {
        previous.current = pathname
    }, [pathname])

    return (
        <motion.div
            key={pathname}
            className={className}
            initial={direction ? { x: direction === 'left' ? SLIDE_OFFSET_PX : -SLIDE_OFFSET_PX, opacity: 0 } : false}
            animate={{ x: 0, opacity: 1 }}
            transition={TAB_SPRING}
        >
            {children}
        </motion.div>
    )
}
