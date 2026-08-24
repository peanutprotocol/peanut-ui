'use client'

import { twMerge } from '@/utils/tw'
import { DEV_CHIP_TONE_CLASS, type DevChipTone } from './devChipTones'

/** Small colour-coded pill for dev-page taxonomies and badges. */
export default function DevChip({
    children,
    tone = 'neutral',
    title,
    className,
}: {
    children: React.ReactNode
    tone?: DevChipTone
    /** Native tooltip — the taxonomy explanation on hover. */
    title?: string
    className?: string
}) {
    return (
        <span
            title={title}
            className={twMerge(
                'inline-block shrink-0 rounded-sm border border-n-1 px-1.5 py-0.5 text-[9px] leading-tight font-bold uppercase',
                DEV_CHIP_TONE_CLASS[tone],
                title && 'cursor-help',
                className
            )}
        >
            {children}
        </span>
    )
}
