'use client'

import { twMerge } from '@/utils/tw'

/**
 * The one section heading for /dev pages. Replaces the four competing idioms
 * that had drifted across the tree (`text-body-s`/`text-body-xs`, `<p>`/`<h2>`,
 * `tracking-wide`/`tracking-wider`, `font-bold`/`font-extrabold`).
 */
export default function DevSectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <h2 className={twMerge('text-label-m tracking-wide text-foreground-secondary uppercase', className)}>
            {children}
        </h2>
    )
}
