import type { ReactNode } from 'react'

export interface SelfCustodyGlyphProps {
    className?: string
}

export interface SelfCustodyAppLinkProps {
    children: ReactNode
    className?: string
}

export interface SelfCustodySendRingProps {
    /** Seconds after the phone comes into view. */
    delay: number
    /** Position and size over the Send button. */
    className?: string
}
