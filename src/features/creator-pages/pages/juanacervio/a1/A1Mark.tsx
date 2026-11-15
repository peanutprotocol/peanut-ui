import type { ReactNode } from 'react'
import type { A1Highlight } from './a1-post.types'

const HIGHLIGHT_CLASS: Record<A1Highlight, string> = {
    yellow: 'bg-avatar-yellow',
    pink: 'bg-avatar-pink',
    lilac: 'bg-background-badge-accent',
}

/**
 * A highlighter stroke over a phrase of Nita's post. The colour ties the phrase to its proof card.
 * `flushEnd` drops the padding after the phrase, for a phrase that a closing quotation mark follows.
 */
export function A1Mark({
    highlight,
    flushEnd,
    children,
}: {
    highlight: A1Highlight
    flushEnd?: boolean
    children: ReactNode
}) {
    return (
        <mark
            className={`rounded-sm box-decoration-clone py-0.5 text-inherit ${flushEnd ? 'pl-1' : 'px-1'} ${HIGHLIGHT_CLASS[highlight]}`}
        >
            {children}
        </mark>
    )
}
