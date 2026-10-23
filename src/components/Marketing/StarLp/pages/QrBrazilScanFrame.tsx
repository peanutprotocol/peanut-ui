'use client'

import { motion, MotionConfig } from 'framer-motion'
import { STAR_LP_SPRING } from '@/components/Marketing/StarLp/starLp.consts'
import { useEntranceArm } from '@/components/Marketing/StarLp/useEntranceArm'
import { twMerge } from '@/utils/tw'
import type { QrBrazilScanFrameProps } from './qrBrazil.types'

const CORNER = 'absolute size-10 border-border-default'

/** Each corner's place on the frame and the direction it snaps in from. */
const CORNERS = [
    { className: '-top-5 -left-5 rounded-tl-card border-t-[5px] border-l-[5px]', x: -14, y: -14 },
    { className: '-top-5 -right-5 rounded-tr-card border-t-[5px] border-r-[5px]', x: 14, y: -14 },
    { className: '-bottom-5 -left-5 rounded-bl-card border-b-[5px] border-l-[5px]', x: -14, y: 14 },
    { className: '-right-5 -bottom-5 rounded-br-card border-r-[5px] border-b-[5px]', x: 14, y: 14 },
] as const

/**
 * A scanner's viewfinder around the closing sticker. Scrolled into view, the
 * four corners snap in onto the code once, the way the app's scanner locks
 * on. At rest on the server, above the fold and under reduced motion.
 */
export function QrBrazilScanFrame({ children, className }: QrBrazilScanFrameProps) {
    const { ref, armed } = useEntranceArm()
    return (
        <MotionConfig reducedMotion="user">
            <div ref={ref} className={twMerge('relative', className)}>
                {CORNERS.map((corner) => (
                    <motion.span
                        key={`${corner.x}${corner.y}${armed ? 'a' : 'r'}`}
                        aria-hidden
                        className={`${CORNER} ${corner.className}`}
                        initial={armed ? { x: corner.x, y: corner.y, opacity: 0 } : false}
                        whileInView={{ x: 0, y: 0, opacity: 1 }}
                        viewport={{ once: true, amount: 0.6 }}
                        transition={{ ...STAR_LP_SPRING.drop, delay: 0.35 }}
                    />
                ))}
                {children}
            </div>
        </MotionConfig>
    )
}
