'use client'

import { motion } from 'framer-motion'
import type { CSSProperties, ReactNode } from 'react'
import { twMerge } from '@/utils/tw'
import { useSetupShell } from './SetupShellContext'
import { ART_DELAY_S, ART_STAGGER_S, type ArtEntrance, entranceVariants } from './shell.motion'
import { useShellDevice } from './useShellDevice'

export type ArtPieceProps = {
    /** Left and top in the art box's design px (390 wide; top 250 = 250 px from the top of a 390x844 phone). */
    left: number
    top: number
    width?: number
    height?: number
    /** Rest angle in degrees. */
    rotate?: number
    /** Plays once, then the piece holds still. Reduced motion shows the rest pose at once. */
    entrance?: ArtEntrance
    /** Place in the entrance order: each step adds the mock's 60 ms stagger. */
    order?: number
    /** Extra delay in seconds, on top of the 100 ms art delay and the stagger. */
    delay?: number
    /** Pure decoration that small phones drop (the mock's data-sm="hide"). */
    smHide?: boolean
    /** Takes taps (the die); everything else in the art layer lets taps through. */
    interactive?: boolean
    zIndex?: number
    className?: string
    style?: CSSProperties
    children: ReactNode
}

/** One absolutely placed piece of hero art. Art comes from approved assets; this only places and animates it. */
export function ArtPiece({
    left,
    top,
    width,
    height,
    rotate = 0,
    entrance = 'none',
    order = 0,
    delay = 0,
    smHide = false,
    interactive = false,
    zIndex,
    className,
    style,
    children,
}: ArtPieceProps) {
    const { reducedMotion } = useSetupShell()
    const device = useShellDevice()
    if (smHide && device === 'sm') return null
    const animate = entrance !== 'none' && !reducedMotion
    const variants = entranceVariants(entrance, rotate, ART_DELAY_S + order * ART_STAGGER_S + delay)
    return (
        <motion.div
            className={twMerge('absolute', interactive ? 'pointer-events-auto' : 'pointer-events-none', className)}
            style={{ left, top, width, height, zIndex, rotate, ...style }}
            variants={variants}
            initial={animate ? 'from' : false}
            animate="to"
            aria-hidden={interactive ? undefined : true}
        >
            {children}
        </motion.div>
    )
}
