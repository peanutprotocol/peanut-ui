import type { PeanutCardContactlessProps } from './peanutCard.types'

/** The contactless mark: three arcs, stroked in the current colour. */
export function PeanutCardContactless({ className }: PeanutCardContactlessProps) {
    return (
        <svg aria-hidden viewBox="0 0 24 24" fill="none" className={className}>
            <path d="M8 8.5a5 5 0 0 1 0 7" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" />
            <path d="M12 5.5a9.5 9.5 0 0 1 0 13" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" />
            <path d="M16 2.5a14 14 0 0 1 0 19" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" />
        </svg>
    )
}
