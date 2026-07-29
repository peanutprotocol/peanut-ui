'use client'

import { twMerge } from 'tailwind-merge'

/**
 * The one section heading for /dev pages. Replaces the four competing idioms
 * that had drifted across the tree (`text-sm`/`text-xs`, `<p>`/`<h2>`,
 * `tracking-wide`/`tracking-wider`, `font-bold`/`font-extrabold`).
 */
export default function DevSectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
    return <h2 className={twMerge('text-xs font-bold uppercase tracking-wide text-grey-1', className)}>{children}</h2>
}
