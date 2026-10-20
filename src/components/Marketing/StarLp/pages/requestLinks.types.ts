import type { ReactNode } from 'react'

export interface RequestLinksLinkCardProps {
    /** Tilt in degrees, for the card resting in a chat. */
    tilt?: number
    className?: string
}

export interface RequestLinksPaidTickProps {
    children: ReactNode
    className?: string
}

export interface RequestLinksAvatarProps {
    size?: 'small' | 'large'
}

export interface RequestLinksTimelineStop {
    time: string
    screen: ReactNode
}
