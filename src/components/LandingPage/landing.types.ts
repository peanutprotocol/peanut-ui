import { type IconName } from '@/components/Global/Icons/Icon'

// shared shape of the landing hero CTA buttons (hero.tsx renders them,
// LandingPageClient builds them from the content system / migration override)
export type CTAButton = {
    label: string
    href: string
    isExternal?: boolean
    subtext?: string
    icon?: IconName
    onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void
}

/**
 * Copy for the problem fold (<ProblemFold />): one heading over three named
 * cards. Each card is a separate title/body pair rather than one list string,
 * so a translator can never collapse three cards into two.
 */
export interface LandingSupportedRailsStrings {
    /** "… {evmCount} … {otherList}:" — interpolated where the chain lists are built */
    crypto: string
    tokens: string
    tokenNote: string
    banks: string
    free: string
    /** conjunction for the non-EVM chain list, shared with the plain-text answer */
    joinAnd: string
}

export interface LandingProblemStrings {
    heading: string
    crossBorderTitle: string
    crossBorderBody: string
    sendHomeTitle: string
    sendHomeBody: string
    paidAbroadTitle: string
    paidAbroadBody: string
}
