'use client'

import { motion, MotionConfig } from 'framer-motion'
import Image from 'next/image'
import { DropIn } from '@/components/Marketing/StarLp/DropIn'
import type { UsEuAccountCaptureProps } from './usEuAccounts.types'

/**
 * A real bank-details screen as a sticker: drops in and swings the other way on
 * hover. It sits in a link, so a tap takes the DS button press (a small scale and
 * the hard shadow dropping) instead of a swing the navigation would cut off.
 */
export function UsEuAccountCapture({ src, tilt, delay, className }: UsEuAccountCaptureProps) {
    return (
        <DropIn fromTilt={tilt * 4} tilt={tilt} delay={delay} className={className}>
            <MotionConfig reducedMotion="user">
                <motion.div
                    className="overflow-hidden rounded-card border-2 border-border-default bg-background-page shadow-4 group-active:shadow-none motion-safe:transition-shadow motion-safe:duration-instant"
                    whileHover={{ rotate: -tilt * 1.5 }}
                    whileTap={{ rotate: 0, scale: 0.97, transition: { duration: 0.12 } }}
                    transition={{ type: 'spring', stiffness: 300, damping: 14 }}
                >
                    <Image src={src} alt="" sizes="(min-width: 768px) 320px, 80vw" className="h-auto w-full" priority />
                </motion.div>
            </MotionConfig>
        </DropIn>
    )
}
