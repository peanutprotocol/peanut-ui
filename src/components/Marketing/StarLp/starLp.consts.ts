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

/** design.md § layout: three containers, always centred. */
export const BAND_WIDTH_CLASS: Record<BandWidth, string> = {
    landing: 'max-w-7xl',
    hub: HUB_WIDTH,
    prose: PROSE_WIDTH,
}

/** Grounds where the DS secondary (white) button stands alone; everything else takes the pink primary. */
export const COLOURED_GROUNDS: readonly BandGround[] = ['pink', 'sky', 'yellow']

/** Knerd Title sizes. 320 steps down once per design.md § display type.
    `masthead` gets its font size from .star-lp-fit-knerd and the inline fit
    properties KnerdTitle sets (starLpHeroFit), so it carries no size class. */
export const KNERD_SIZE_CLASS: Record<KnerdSize, string> = {
    masthead: 'block',
    hero: 'text-headingSmall xs:text-heading md:text-headingMedium lg:text-headingLarge',
    compact: 'text-heading-m xs:text-headingSmall md:text-heading lg:text-headingMedium',
    inline: 'text-heading-l',
}

export const DISPLAY_LINE_CLASS: Record<DisplayLineSize, string> = {
    masthead: 'star-lp-fit-display',
    lead: 'text-heading-m md:text-headingSmall',
    section: 'text-headingSmall md:text-headingMedium',
    join: 'text-[0.3em]',
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
