'use client'

import { motion, useReducedMotion } from 'framer-motion'
import PeanutMascot from './index'
import { twMerge } from '@/utils/tw'

export type PeanutMascotSceneName = 'paper-planes'

const PaperPlane = () => (
    <svg viewBox="0 0 48 44" className="h-full w-full" aria-hidden="true">
        <path
            d="M3 16 45 3 34 41 23 28 13 36 16 25Z"
            className="fill-white stroke-black"
            strokeWidth="3"
            strokeLinejoin="round"
        />
        <path d="m16 25 29-22-22 25" className="fill-none stroke-black" strokeWidth="3" strokeLinejoin="round" />
    </svg>
)

/** Reusable mascot scenes; all looping movement stops for reduced motion. */
export const PeanutMascotScene = ({ scene, className }: { scene: PeanutMascotSceneName; className?: string }) => {
    const reducedMotion = useReducedMotion()

    return (
        <div
            className={twMerge('relative h-52 w-full max-w-64 overflow-visible', className)}
            aria-hidden="true"
            data-mascot-scene={scene}
        >
            {scene === 'paper-planes' && (
                <>
                    <PeanutMascot
                        pose="waving-hello"
                        className="absolute bottom-0 left-1/2 h-40 w-auto -translate-x-1/2"
                    />
                    <motion.div
                        className="absolute top-7 left-1 h-10 w-10"
                        animate={
                            reducedMotion
                                ? undefined
                                : { x: [0, 28, 12, 0], y: [0, -18, -30, 0], rotate: [-18, 3, 18, -18] }
                        }
                        transition={{ duration: 3.8, repeat: Infinity, ease: 'easeInOut' }}
                    >
                        <PaperPlane />
                    </motion.div>
                    <motion.div
                        className="absolute top-2 right-4 h-8 w-8"
                        animate={
                            reducedMotion
                                ? undefined
                                : { x: [0, -22, -6, 0], y: [0, 16, 26, 0], rotate: [18, -8, -22, 18] }
                        }
                        transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
                    >
                        <PaperPlane />
                    </motion.div>
                    <motion.div
                        className="absolute right-0 bottom-7 h-7 w-7"
                        animate={
                            reducedMotion
                                ? undefined
                                : { x: [0, -18, -28, 0], y: [0, -22, 7, 0], rotate: [24, -12, 14, 24] }
                        }
                        transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut', delay: 0.8 }}
                    >
                        <PaperPlane />
                    </motion.div>
                </>
            )}
        </div>
    )
}
