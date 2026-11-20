'use client'

import { motion, useReducedMotion } from 'framer-motion'
import Image from 'next/image'
import PeanutMascot from './index'
import { twMerge } from '@/utils/tw'

export type PeanutMascotSceneName = 'megaphone'

// The MINI_INFLUENCER badge sticker, approved for this scene by Konrad on
// 2026-11-20 (listed on /dev/ds/marketing/assets). Art is never drawn here.
const MEGAPHONE_SRC = '/badges/mini_influencer.svg'

/** Reusable mascot scenes; all looping movement stops for reduced motion. */
export const PeanutMascotScene = ({ scene, className }: { scene: PeanutMascotSceneName; className?: string }) => {
    const reducedMotion = useReducedMotion()

    return (
        <div
            className={twMerge('relative h-52 w-full max-w-64 overflow-visible', className)}
            aria-hidden="true"
            data-mascot-scene={scene}
        >
            {scene === 'megaphone' && (
                <>
                    <PeanutMascot
                        pose="waving-hello"
                        className="absolute bottom-0 left-1/2 h-40 w-auto -translate-x-1/2"
                    />
                    <motion.div
                        className="absolute top-1 -right-4 h-16 w-16"
                        initial={{ rotate: -10 }}
                        animate={
                            reducedMotion
                                ? undefined
                                : { x: [0, -4, 2, 0], y: [0, -8, -3, 0], rotate: [-10, 4, -4, -10] }
                        }
                        transition={{ duration: 3.8, repeat: Infinity, ease: 'easeInOut' }}
                    >
                        <Image src={MEGAPHONE_SRC} alt="" width={64} height={64} unoptimized className="size-full" />
                    </motion.div>
                </>
            )}
        </div>
    )
}
