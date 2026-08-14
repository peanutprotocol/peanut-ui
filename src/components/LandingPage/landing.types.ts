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
export interface LandingProblemStrings {
    heading: string
    crossBorderTitle: string
    crossBorderBody: string
    sendHomeTitle: string
    sendHomeBody: string
    paidAbroadTitle: string
    paidAbroadBody: string
}
