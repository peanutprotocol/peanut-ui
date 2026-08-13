'use client'

import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { ADMISSIONS_PER_WEEK } from '@/components/Card/doorTally.utils'

// The counter starts one above the real weekly rate and ticks down once, so
// the number reads as live.
const COUNTER_START = ADMISSIONS_PER_WEEK + 1

/**
 * "Only N a week" scarcity pill, shared by the homepage card beat and the
 * /shhhhh hero. `label` builds the copy for a given count — each surface has
 * its own catalog, so the interpolation stays at the call site.
 */
export function ScarcityCounter({ label }: { label: (count: number) => string }) {
    const prefersReducedMotion = useReducedMotion()
    const [count, setCount] = useState(COUNTER_START)

    useEffect(() => {
        if (prefersReducedMotion) {
            setCount(ADMISSIONS_PER_WEEK)
            return
        }
        const timer = setTimeout(() => setCount(ADMISSIONS_PER_WEEK), 2500)
        return () => clearTimeout(timer)
    }, [prefersReducedMotion])

    const ticked = count === ADMISSIONS_PER_WEEK

    return (
        <motion.span
            className="mx-1 inline-block whitespace-nowrap bg-n-1 px-2 py-0.5 text-[0.92em] font-extraBlack uppercase tracking-wider text-primary-1"
            animate={ticked && !prefersReducedMotion ? { scale: [1, 1.18, 1] } : {}}
            transition={{ duration: 0.5, ease: 'easeOut' }}
        >
            {label(count)}
        </motion.span>
    )
}
