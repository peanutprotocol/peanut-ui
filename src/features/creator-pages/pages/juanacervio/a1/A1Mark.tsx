import type { ReactNode } from 'react'
import type { A1Highlight } from './a1-post.types'

const HIGHLIGHT_CLASS: Record<A1Highlight, string> = {
    yellow: 'bg-avatar-yellow',
    pink: 'bg-avatar-pink',
    lilac: 'bg-background-badge-accent',
}

/**
 * A highlighter stroke over a phrase of Nita's post. The colour ties the phrase to its proof card.
 * The shape of the stroke is in NitaA1.module.css (`.a1 mark`, and `.proof mark` before a closing quotation mark).
 */
export function A1Mark({ highlight, children }: { highlight: A1Highlight; children: ReactNode }) {
    return <mark className={HIGHLIGHT_CLASS[highlight]}>{children}</mark>
}
