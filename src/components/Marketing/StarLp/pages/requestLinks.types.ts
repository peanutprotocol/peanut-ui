import type { ReactNode } from 'react'

export interface RequestLinksLinkCardProps {
    /** Tilt in degrees, for the card resting in a chat. */
    tilt?: number
    className?: string
    /** An in-page fold id to scroll to instead of signup. */
    to?: string
}

export interface RequestLinksPaidTickProps {
    children: ReactNode
    className?: string
}

export interface RequestLinksAvatarProps {
    size?: 'small' | 'large'
}

export interface RequestLinksAppLinkProps {
    children: ReactNode
    className?: string
    /** An in-page fold id to scroll to instead of signup. */
    to?: string
    /** How far the piece sinks on press: 'sm' for a shadow-2 piece, 'md' for a shadow-4 piece. */
    sink?: 'sm' | 'md'
}

export interface RequestLinksTimelineStop {
    time: string
    screen: ReactNode
}
