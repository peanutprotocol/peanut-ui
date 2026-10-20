'use client'

import { motion, MotionConfig } from 'framer-motion'
import { useEntranceArm } from '@/components/Marketing/StarLp/useEntranceArm'
import type { PeanutCardRiseProps } from './peanutCard.types'

const RISE_HIDDEN = { opacity: 0, y: 10 }
const RISE_SHOWN = { opacity: 1, y: 0 }
const RULE_HIDDEN = { scaleX: 0 }
const RULE_SHOWN = { scaleX: 1 }

/**
 * One staggered piece of "Probably not for you.": a paragraph that rises 10px
 * into place, or the divider drawn left to right. It arms only when it starts
 * below the viewport (useEntranceArm), so nothing is hidden at rest or with JS off.
 */
export function PeanutCardRise({ children, delay, variant, className }: PeanutCardRiseProps) {
    const { ref, armed } = useEntranceArm()
    const hidden = variant === 'rule' ? RULE_HIDDEN : RISE_HIDDEN
    const shown = variant === 'rule' ? RULE_SHOWN : RISE_SHOWN
    const transition =
        variant === 'rule'
            ? { duration: 0.5, ease: 'easeOut' as const, delay }
            : { duration: 0.5, ease: [0.34, 1.56, 0.64, 1] as const, delay }

    return (
        <MotionConfig reducedMotion="user">
            <motion.div
                key={armed ? 'armed' : 'rest'}
                ref={ref}
                aria-hidden={variant === 'rule' ? true : undefined}
                className={variant === 'rule' ? `h-0.5 origin-left bg-white/25 ${className ?? ''}` : className}
                initial={armed ? hidden : false}
                animate={armed ? undefined : shown}
                whileInView={armed ? shown : undefined}
                viewport={{ once: true, amount: 0.5 }}
                transition={transition}
            >
                {children}
            </motion.div>
        </MotionConfig>
    )
}
