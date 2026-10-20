'use client'

import { motion, MotionConfig } from 'framer-motion'
import { STAR_LP_SPRING } from './starLp.consts'
import { useEntranceArm } from './useEntranceArm'
import type { PopInProps } from './starLp.types'

/**
 * Scroll entrance for one element: rises 16px, scales up from 0.94 and lands
 * on its tilt with a soft spring, once. Renders at rest on the server and
 * above the fold (see useEntranceArm). Under reduced motion it only fades.
 */
export function PopIn({ children, delay = 0, tilt = 0, className }: PopInProps) {
    const { ref, armed } = useEntranceArm()
    const overshoot = tilt === 0 ? 0 : Math.sign(tilt) * 4
    const rest = { opacity: 1, y: 0, scale: 1, rotate: tilt }
    return (
        <MotionConfig reducedMotion="user">
            {/* the key remounts the node when it arms, so the hidden start state applies */}
            <motion.div
                key={armed ? 'armed' : 'rest'}
                ref={ref}
                className={className}
                initial={armed ? { opacity: 0, y: 16, scale: 0.94, rotate: tilt + overshoot } : false}
                animate={armed ? undefined : rest}
                whileInView={armed ? rest : undefined}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ ...STAR_LP_SPRING.pop, delay }}
            >
                {children}
            </motion.div>
        </MotionConfig>
    )
}
