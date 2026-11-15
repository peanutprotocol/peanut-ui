import type { ReactNode } from 'react'
import type { A1Highlight } from '../nita-a1.copy'

const HIGHLIGHT_CLASS: Record<A1Highlight, string> = {
    yellow: 'bg-avatar-yellow',
    pink: 'bg-avatar-pink',
    lilac: 'bg-background-badge-accent',
}

/** A highlighter stroke over a phrase of Nita's post. The colour ties the phrase to its proof card. */
export function A1Mark({ highlight, children }: { highlight: A1Highlight; children: ReactNode }) {
    return (
        <mark className={`rounded-sm box-decoration-clone px-1 py-0.5 text-inherit ${HIGHLIGHT_CLASS[highlight]}`}>
            {children}
        </mark>
    )
}
