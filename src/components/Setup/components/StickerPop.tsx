'use client'

import { type ReactNode } from 'react'
import { motion } from 'framer-motion'

// Fast rubber-hose pop on the DS ease-spring curve (Konrad, 2026-10-25: no calm loops).
const EASE_SPRING = [0.34, 1.56, 0.64, 1] as const
const EASE_SHARP = [0.87, 0, 0.13, 1] as const
const POP = { duration: 0.3, ease: EASE_SPRING } as const
const BOB = { duration: 0.5, ease: EASE_SHARP, repeat: Infinity, repeatType: 'reverse', repeatDelay: 0.5 } as const

/** A sticker that pops in on mount and then bobs on the beat; reduced motion shows the resting frame. */
export default function StickerPop({
    children,
    className,
    delay = 0,
    rotate = 0,
    bob = 0,
    still,
}: {
    children: ReactNode
    className?: string
    /** Seconds; keep to the motion scale (0.1, 0.2, 0.3, 0.5). */
    delay?: number
    rotate?: number
    /** Bob height in px; 0 keeps the sticker still after the pop. */
    bob?: number
    still: boolean
}) {
    if (still) {
        return (
            <motion.div className={className} initial={false} animate={{ rotate }}>
                {children}
            </motion.div>
        )
    }
    return (
        <motion.div
            className={className}
            initial={{ scale: 0.3, rotate: rotate + 12, opacity: 0 }}
            animate={{ scale: 1, rotate, opacity: 1 }}
            transition={{ ...POP, delay }}
        >
            {bob ? (
                <motion.div
                    data-sticker-bob
                    animate={{ y: [0, -bob] }}
                    transition={{ ...BOB, delay: delay + POP.duration }}
                >
                    {children}
                </motion.div>
            ) : (
                children
            )}
        </motion.div>
    )
}
