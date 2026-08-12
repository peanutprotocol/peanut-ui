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
 * Copy for the card beat (<CardBeat />).
 *
 * Two lines wrap an element rather than a string — the /setup anchor in the
 * bridge line and the counter chip in the body — so each arrives pre-split
 * into halves. A split-on-placeholder would drop the tail silently once a
 * translator loses the placeholder; separate keys cannot fail that way.
 */
export interface LandingCardBeatStrings {
    bridgeBefore: string
    bridgeLinkLabel: string
    bridgeAfter: string
    kicker: string
    heading: string
    tagline: string
    bodyBefore: string
    /** Carries "{count}" — the component substitutes the live number. */
    counterLabel: string
    bodyAfter: string
    custody: string
    trust: string
    waitlistLink: string
    /** Stat-tile labels. The numerals themselves are not translatable. */
    statMerchants: string
    statBalance: string
    statCard: string
    statMonthlyFees: string
}

/** Copy for the manifesto beat (<Manifesto />). */
export interface LandingManifestoStrings {
    heading: string
    subline: string
}

/** Copy for the problem beat (<ProblemProse />). Pointers anchor to #works-today. */
export interface LandingProblemStrings {
    heading: string
    prose: string
    pointerPassport: string
    pointerRate: string
    pointerMoneyOut: string
}

/**
 * Copy for the "what works today" beat (<WorksToday />). The drop-link body,
 * the markup-row label and the rate-widget labels stay on the top-level bag —
 * they predate this beat and are shared with /exchange.
 */
export interface LandingWorksTodayStrings {
    heading: string
    subline: string
    payLocalTitle: string
    payLocalBody: string
    payLocalNote: string
    payLocalMoneyOut: string
    payLocalChipEurPix: string
    payLocalChipUsdMercadoPago: string
    dropLinkTitle: string
    rateTitle: string
    securityTitle: string
    securityBody: string
}

/** Copy for the ending beat (<NotForYou />). */
export interface LandingNotForYouStrings {
    heading: string
    body: string
    signUpLink: string
}
