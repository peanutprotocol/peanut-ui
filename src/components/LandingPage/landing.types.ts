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

/** f3: the persona fold's h2 and the two earners' trade, city and line, in the page language. */
export interface HomePersonaStrings {
    heading: string
    designerWho: string
    designerLine: string
    developerWho: string
    developerLine: string
}
