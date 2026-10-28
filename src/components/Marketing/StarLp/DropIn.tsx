'use client'

import { motion, MotionConfig } from 'framer-motion'
import { STAR_LP_SPRING } from './starLp.consts'
import { useEntranceArm } from './useEntranceArm'
import type { DropInProps } from './starLp.types'

/**
 * A sticker landing: falls from above at a tilt and half size, overshoots and
 * settles (Split's final-CTA faces). For avatars, receipts, cards. Once.
 * Renders at rest on the server and above the fold (see useEntranceArm), so
 * hero art never waits for hydration.
 */
export function DropIn({ children, delay = 0, fromTilt = -12, tilt = 0, className, entrance }: DropInProps) {
    const { ref, armed: locallyArmed } = useEntranceArm()
    const armed = entrance?.armed ?? locallyArmed
    const rest = { opacity: 1, y: 0, scale: 1, rotate: tilt }
    return (
        <MotionConfig reducedMotion="user">
            {/* the key remounts the node when it arms, so the hidden start state applies */}
            <motion.div
                key={armed ? 'armed' : 'rest'}
                ref={ref}
                className={className}
                initial={armed ? { opacity: 0, y: -24, scale: 0.6, rotate: fromTilt } : false}
                animate={armed ? (entrance?.visible ? rest : undefined) : rest}
                whileInView={armed && !entrance ? rest : undefined}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ ...STAR_LP_SPRING.drop, delay }}
            >
                {children}
            </motion.div>
        </MotionConfig>
    )
}
