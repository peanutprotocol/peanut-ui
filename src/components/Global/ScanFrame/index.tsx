'use client'

import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { twMerge } from '@/utils/tw'

// Corner length, line weight and radius per size. `md` is the in-app frame, `lg` the marketing one.
const SIZES = {
    md: {
        tl: 'size-[34px] rounded-tl-lg border-t-4 border-l-4',
        tr: 'size-[34px] rounded-tr-lg border-t-4 border-r-4',
        bl: 'size-[34px] rounded-bl-lg border-b-4 border-l-4',
        br: 'size-[34px] rounded-br-lg border-r-4 border-b-4',
    },
    lg: {
        tl: 'size-10 rounded-tl-card border-t-[5px] border-l-[5px]',
        tr: 'size-10 rounded-tr-card border-t-[5px] border-r-[5px]',
        bl: 'size-10 rounded-bl-card border-b-[5px] border-l-[5px]',
        br: 'size-10 rounded-br-card border-r-[5px] border-b-[5px]',
    },
} as const

// Where each corner sits and the diagonal it slides in from.
const CORNERS = [
    { id: 'tl', place: 'top-0 left-0', from: { x: -12, y: -12 } },
    { id: 'tr', place: 'top-0 right-0', from: { x: 12, y: -12 } },
    { id: 'bl', place: 'bottom-0 left-0', from: { x: -12, y: 12 } },
    { id: 'br', place: 'right-0 bottom-0', from: { x: 12, y: 12 } },
] as const

export interface ScanFrameProps {
    /** What the frame holds. Position and size it yourself; the frame only draws the corners round it. */
    children?: ReactNode
    /** Corner marks: `md` is 34 px with a 4 px line, `lg` is 40 px with a 5 px line. */
    size?: keyof typeof SIZES
    /** While true, a bar sweeps up and down inside the frame, over the children. */
    scanLine?: boolean
    /** The corners slide in from outside once, on mount. */
    entrance?: boolean
    /** Sizes and places the frame. It is `relative` unless a class here says otherwise. */
    className?: string
}

/**
 * The scanner frame: four corner marks round whatever it holds, as on the app's QR scanner. A UI object, not art.
 * It has no reduced-motion logic of its own: pass `scanLine` and `entrance` as false when motion is off.
 */
export function ScanFrame({ children, size = 'md', scanLine = false, entrance = false, className }: ScanFrameProps) {
    return (
        <div className={twMerge('relative', className)} data-scan-frame>
            {CORNERS.map((corner) => (
                <motion.span
                    key={corner.id}
                    aria-hidden
                    className={twMerge('absolute border-0 border-border-default', corner.place, SIZES[size][corner.id])}
                    initial={entrance ? { ...corner.from, opacity: 0 } : false}
                    animate={{ x: 0, y: 0, opacity: 1 }}
                    transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                />
            ))}
            {children}
            {scanLine && (
                // The track is one bar short of the frame's padded height, so the bar stops at the bottom corners.
                <motion.span
                    aria-hidden
                    className="pointer-events-none absolute inset-x-3 top-3 bottom-[18px] z-10"
                    initial={{ y: '0%' }}
                    animate={{ y: '100%' }}
                    transition={{ duration: 0.52, repeat: Infinity, repeatType: 'reverse', ease: [0.5, 0, 0.5, 1] }}
                    data-scan-line
                >
                    <span className="shadow-2 absolute inset-x-0 top-0 h-1.5 rounded-full border-[1.5px] border-border-default bg-background-default" />
                </motion.span>
            )}
        </div>
    )
}
