'use client'

import { PEANUT_SITTING } from '@/assets/mascot'
import { motion, useReducedMotion } from 'framer-motion'
import Image from 'next/image'
import PeanutMascot from './index'
import { twMerge } from '@/utils/tw'

export type PeanutMascotSceneName = 'paper-planes' | 'safe' | 'coins'

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

const GoldenCoin = () => (
    <svg viewBox="0 0 48 48" className="h-full w-full" aria-hidden="true">
        <circle cx="24" cy="24" r="21" className="fill-yellow-500 stroke-black" strokeWidth="3" />
        <circle cx="24" cy="24" r="15" className="fill-none stroke-yellow-900" strokeWidth="2" />
        <path d="m24 14 2.5 7.5L34 24l-7.5 2.5L24 34l-2.5-7.5L14 24l7.5-2.5Z" className="fill-yellow-200" />
    </svg>
)

const SafeBox = () => (
    <svg viewBox="0 0 180 130" className="absolute bottom-0 left-1/2 h-28 w-40 -translate-x-1/2" aria-hidden="true">
        <rect x="8" y="8" width="164" height="114" rx="10" className="fill-blue-300 stroke-black" strokeWidth="5" />
        <rect x="26" y="22" width="128" height="87" rx="5" className="fill-white stroke-black" strokeWidth="4" />
        <circle cx="90" cy="65" r="29" className="fill-yellow-500 stroke-black" strokeWidth="4" />
        <circle cx="90" cy="65" r="15" className="fill-yellow-200 stroke-black" strokeWidth="3" />
        <path d="M90 39v12m0 28v12M64 65h12m28 0h12" className="stroke-black" strokeWidth="4" strokeLinecap="round" />
        <path d="M31 122v5m118-5v5" className="stroke-black" strokeWidth="6" strokeLinecap="round" />
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

            {scene === 'safe' && (
                <>
                    <SafeBox />
                    <div className="absolute bottom-8 left-1/2 h-40 w-36 -translate-x-1/2">
                        <motion.div
                            className="h-full w-full"
                            animate={reducedMotion ? undefined : { y: [0, -4, 0] }}
                            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                        >
                            <Image src={PEANUT_SITTING} alt="" className="h-full w-full object-contain" />
                        </motion.div>
                    </div>
                </>
            )}

            {scene === 'coins' && (
                <>
                    <PeanutMascot pose="cheering" className="absolute bottom-0 left-1/2 h-40 w-auto -translate-x-1/2" />
                    <motion.div
                        className="absolute top-11 left-2 h-10 w-10"
                        animate={
                            reducedMotion
                                ? undefined
                                : { x: [0, 34, 70, 0], y: [0, -37, 0, 0], rotate: [0, 180, 360, 360] }
                        }
                        transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
                    >
                        <GoldenCoin />
                    </motion.div>
                    <motion.div
                        className="absolute top-2 left-1/2 h-9 w-9"
                        animate={
                            reducedMotion
                                ? undefined
                                : { x: [0, -28, -55, 0], y: [0, 23, 45, 0], rotate: [0, 180, 360, 360] }
                        }
                        transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut', delay: 0.9 }}
                    >
                        <GoldenCoin />
                    </motion.div>
                    <motion.div
                        className="absolute top-12 right-2 h-11 w-11"
                        animate={
                            reducedMotion
                                ? undefined
                                : { x: [0, -35, -70, 0], y: [0, -40, 0, 0], rotate: [0, 180, 360, 360] }
                        }
                        transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut', delay: 1.8 }}
                    >
                        <GoldenCoin />
                    </motion.div>
                </>
            )}
        </div>
    )
}
