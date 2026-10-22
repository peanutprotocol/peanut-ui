'use client'

import { motion, MotionConfig } from 'framer-motion'
import type { ReactNode } from 'react'
import { STAR_LP_SPRING } from '@/components/Marketing/StarLp/starLp.consts'
import { useEntranceArm } from '@/components/Marketing/StarLp/useEntranceArm'
import { QrArgentinaScanLine } from './QrArgentinaScanLine'

// The four corners of the app's scanner frame, each with the diagonal it locks in from.
const CORNERS = [
    { className: 'top-0 left-0 border-t-[5px] border-l-[5px] rounded-tl-card', x: -10, y: -10 },
    { className: 'top-0 right-0 border-t-[5px] border-r-[5px] rounded-tr-card', x: 10, y: -10 },
    { className: 'bottom-0 left-0 border-b-[5px] border-l-[5px] rounded-bl-card', x: -10, y: 10 },
    { className: 'bottom-0 right-0 border-b-[5px] border-r-[5px] rounded-br-card', x: 10, y: 10 },
]

const SCAN_DELAY = 0.45
const SCAN_S = 0.7
const PULSE_DELAY = SCAN_DELAY + SCAN_S

/**
 * The app's scanner frame round the closing sticker. Once in view, the
 * corners spring in from outside, one scan line sweeps the sticker, and the
 * sticker gives one "detected" pulse. Plays once; at rest without JS, above
 * the fold or under reduced motion (useEntranceArm).
 */
export function QrArgentinaScanFrame({ children }: { children: ReactNode }) {
    const { ref, armed } = useEntranceArm()
    return (
        <MotionConfig reducedMotion="user">
            {/* the key remounts the node when it arms, so the hidden start state applies */}
            <motion.div
                key={armed ? 'armed' : 'rest'}
                ref={ref}
                className="relative mx-auto mt-10 w-44 p-4 md:w-52"
                initial={armed ? 'hidden' : false}
                whileInView={armed ? 'locked' : undefined}
                viewport={{ once: true, amount: 0.6 }}
            >
                {CORNERS.map((corner, i) => (
                    <motion.span
                        key={corner.className}
                        aria-hidden
                        className={`absolute size-10 border-border-default ${corner.className}`}
                        variants={{
                            hidden: { opacity: 0, x: corner.x, y: corner.y },
                            locked: { opacity: 1, x: 0, y: 0, transition: { ...STAR_LP_SPRING.drop, delay: i * 0.06 } },
                        }}
                    />
                ))}
                <motion.div
                    variants={{
                        hidden: { scale: 1 },
                        locked: { scale: [1, 1.03, 1], transition: { duration: 0.22, delay: PULSE_DELAY } },
                    }}
                >
                    {children}
                </motion.div>
                <span aria-hidden className="pointer-events-none absolute inset-4 overflow-hidden">
                    <motion.span
                        className="absolute inset-0 block"
                        variants={{
                            hidden: { y: '0%' },
                            locked: {
                                y: '100%',
                                transition: { duration: SCAN_S, delay: SCAN_DELAY, ease: 'easeInOut' },
                            },
                        }}
                    >
                        <motion.span
                            className="absolute inset-0 block"
                            variants={{
                                hidden: { opacity: 0 },
                                locked: {
                                    opacity: [0, 1, 1, 0],
                                    transition: { duration: SCAN_S, delay: SCAN_DELAY, times: [0, 0.1, 0.8, 1] },
                                },
                            }}
                        >
                            <QrArgentinaScanLine />
                        </motion.span>
                    </motion.span>
                </span>
            </motion.div>
        </MotionConfig>
    )
}
