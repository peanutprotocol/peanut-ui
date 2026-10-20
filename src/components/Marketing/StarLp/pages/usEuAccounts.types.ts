import type { ReactNode } from 'react'

/** One drawn Peanut account in the hero pair. */
export interface UsEuAccountCardProps {
    /** Flag file under public/flags, e.g. 'eu'. */
    flag: string
    /** The app's own name for it, e.g. "EUR account". */
    label: string
    /** Masked details line. */
    details: string
    /** Ground of the card; the euro card sits on sky. */
    tone: 'white' | 'sky'
}

/** One row of the How it works timeline: a clock time beside a drawn moment. */
export interface UsEuTimelineRowProps {
    time: string
    children: ReactNode
}
