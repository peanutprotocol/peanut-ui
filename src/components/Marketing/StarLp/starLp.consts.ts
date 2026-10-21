import type { CloudConfig } from '@/components/LandingPage/CloudsCss'
import { HUB_WIDTH, PROSE_WIDTH } from '@/constants/layout.consts'
import type { BandGround, BandWidth, DisplayLineSize, KnerdSize, SectionTitleSize } from './starLp.types'

/** Ground → tokens. Text colour rides with the ground so a band never sets its own. */
export const BAND_GROUND_CLASS: Record<BandGround, string> = {
    pink: 'bg-background-brand text-foreground-primary',
    cream: 'bg-background-page text-foreground-primary',
    sky: 'bg-background-marketing-sky text-foreground-primary',
    yellow: 'bg-yellow-500 text-foreground-primary',
    black: 'bg-gray-950 text-foreground-inverse',
    white: 'bg-background-default text-foreground-primary',
}

/** Ground → its colour as text, for a Title mark's knockout (the ground-coloured letters under the fill). */
export const BAND_GROUND_KNOCKOUT_CLASS: Record<BandGround, string> = {
    pink: 'text-background-brand',
    cream: 'text-background-page',
    sky: 'text-background-marketing-sky',
    yellow: 'text-yellow-500',
    black: 'text-gray-950',
    white: 'text-background-default',
}

/** design.md § layout: three containers, always centred. */
export const BAND_WIDTH_CLASS: Record<BandWidth, string> = {
    landing: 'max-w-7xl',
    hub: HUB_WIDTH,
    prose: PROSE_WIDTH,
}

/** Grounds where the DS secondary (white) button stands alone; everything else takes the pink primary. */
export const COLOURED_GROUNDS: readonly BandGround[] = ['pink', 'sky', 'yellow']

/** Knerd Title sizes. 320 steps down once per design.md § display type. Static Knerd stays on
    the display ramp ("the marketing display ramp is the only display scale"), so `hero` tops out
    at headingLarge. */
export const KNERD_SIZE_CLASS: Record<KnerdSize, string> = {
    hero: 'text-headingSmall xs:text-heading md:text-headingMedium lg:text-headingLarge',
    compact: 'text-heading-m xs:text-headingSmall md:text-heading lg:text-headingMedium',
    inline: 'text-heading-l',
    /** an amount beside UI in a strip: inline at 320, one step up from xs */
    amount: 'text-heading-l xs:text-headingSmall',
}

export const DISPLAY_LINE_CLASS: Record<DisplayLineSize, string> = {
    masthead: 'star-lp-fit-display',
    lead: 'text-heading-m md:text-headingSmall',
    section: 'text-headingSmall md:text-headingMedium',
}

/** SectionTitle ramps. `fold` stays at or under the hero h1's weight in a half-width
    column (30 → 42 md → 60 lg); `display` is the old 42 → 80 for one-line titles. */
export const SECTION_TITLE_CLASS: Record<SectionTitleSize, string> = {
    fold: 'text-heading-m md:text-headingSmall lg:text-heading',
    display: 'text-headingSmall md:text-headingMedium',
}

/** The six routes. Pages are noindex until Konrad approves them. */
export const STAR_LP_ROUTES = {
    usEuAccounts: '/us-europe-accounts',
    qrArgentina: '/qr-payments/argentina',
    qrBrazil: '/qr-payments/brazil',
    peanutCard: '/peanut-card',
    requestLinks: '/request-links',
    selfCustody: '/self-custody',
} as const

/** CTA destinations while the PWA-sunset flag is off (on: /app for all). */
export const STAR_LP_HREF = {
    signup: '/setup',
    cardGuest: `/setup?redirect_uri=${encodeURIComponent('/card')}`,
    cardSignedIn: '/card',
    /** /us-europe-accounts: the bank-accounts list (held accounts plus every corridor offered). */
    accountsGuest: `/setup?redirect_uri=${encodeURIComponent('/add-money?method=bank')}`,
    accountsSignedIn: '/add-money?method=bank',
} as const

/** Scene springs, ported from peanutsplit motion.ts (stiffness / damping). */
export const STAR_LP_SPRING = {
    pop: { type: 'spring', stiffness: 260, damping: 20 },
    drop: { type: 'spring', stiffness: 320, damping: 18 },
} as const

/** One-shot story beat spacing, ms. */
export const STORY_STEP_MS = 700

/** Marks a story beat with its 0-based index, so useStoryStep can keep beats already on screen shown. */
export const STORY_BEAT_ATTR = 'data-story-beat'

/** The Follow the pull headline's hidden how-to, outside the h1 (one hero per page). */
export const KNERD_PULL_HELP_ID = 'star-lp-knerd-help'

/** The black trust band's one line, the same on every page that has one. security.md
    supports a Peanut-scoped claim only ("Peanut cannot freeze user accounts"); partners
    still run their own checks on the bank side, so never "no one". */
export const STAR_LP_TRUST_LINE = "Peanut can't freeze\nyour account."

/**
 * Two drifting clouds in a sky fold (peanut.me's CloudsCss), one in the band's top padding
 * and one in its bottom padding, so they never cross the title or the art. 120px wide
 * is 57px tall, which fits the 64px mobile padding; --sky-cloud-inset centres them in it.
 * Use with STAR_LP_SKY_CLOUDS_CLASS on the CloudsCss.
 */
export const STAR_LP_SKY_CLOUDS = [
    { top: 'var(--sky-cloud-inset)', width: 120, speed: '38s', direction: 'ltr' },
    { top: 'calc(100% - 57px - var(--sky-cloud-inset))', width: 120, speed: '34s', direction: 'rtl' },
] as const satisfies CloudConfig[]

/** Band clips (overflow-hidden) and its column is relative z-10: the clouds span the whole band,
    padding included (-inset-y matches MARKETING_BAND_PADDING), behind the content. */
export const STAR_LP_SKY_CLOUDS_CLASS =
    'pointer-events-none -inset-y-16 left-1/2 -z-10 h-auto w-screen -translate-x-1/2 [--sky-cloud-inset:4px] md:-inset-y-24 md:[--sky-cloud-inset:20px]'
