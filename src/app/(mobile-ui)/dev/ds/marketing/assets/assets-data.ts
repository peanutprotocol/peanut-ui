// Marketing asset inventory: the approved brand art — mascot, hero art, doodles,
// gloves, logo set, easter eggs, avatars, badges — and where each piece is used.
// An asset that is not listed here is not approved. Files decided fix-later in
// the Oct 2026 sweep stay in production but are not listed.

import type { StaticImageData } from 'next/image'
import type { MascotPose } from '@/components/Global/PeanutMascot/PeanutMascot.types'
import { LOGO, LOGO_LOCKUP, WORDMARK } from '@/assets/brand'
import { PEANUTMAN_MOBILE, PEANUT_SITTING } from '@/assets/mascot'
import { EASTER_EGG_COUNTRIES } from '@/components/Global/EasterEggDrawer/easter-egg-countries.consts'
import { LETTERS, avatarSrc } from '@/components/Avatar/avatar.utils'
import { getTierBadge } from '@/features/rewards/utils'
import badgeAssets from '@/types/badge-assets.json'

import peanutCardHand from '@/assets/cards/peanut-card-hand.svg'
import globalCashLocalFeel from '@/assets/illustrations/global-cash-local-feel.png'
import borderCloud from '@/assets/illustrations/border-cloud.svg'
import exclamations from '@/assets/illustrations/exclamations.svg'
import eyes from '@/assets/illustrations/eyes.svg'
import flagAr from '@/assets/illustrations/flag-ar.svg'
import flagBr from '@/assets/illustrations/flag-br.svg'
import gotItHand from '@/assets/illustrations/got-it-hand.svg'
import gotItHandFlipped from '@/assets/illustrations/got-it-hand-flipped.svg'
import handMiddleFinger from '@/assets/illustrations/hand-middle-finger.svg'
import handPeace from '@/assets/illustrations/hand-peace.svg'
import handThumbsUp from '@/assets/illustrations/hand-thumbs-up.svg'
import handWaving from '@/assets/illustrations/hand-waving.svg'
import landingCountries from '@/assets/illustrations/landing-countries.svg'
import scribbleCircle from '@/assets/illustrations/scribble-circle.svg'
import sparkle from '@/assets/illustrations/sparkle.svg'
import stackCoin from '@/assets/illustrations/stack-coin.svg'
import star from '@/assets/illustrations/star.svg'

export interface MascotEntry {
    pose: MascotPose
    usedFor: string
}

/**
 * All 10 canonical poses. Source: mono/assets/mascot/lottie — recolour there,
 * never the export, or the next re-export reverts it.
 */
export const MASCOT_ENTRIES: MascotEntry[] = [
    { pose: 'waving-chill', usedFor: 'Landing hero; relaxed moments' },
    { pose: 'cheering', usedFor: 'Claim and payment success' },
    { pose: 'thinking', usedFor: 'Loading, verification waits' },
    { pose: 'too-cool', usedFor: 'Confident flex moments' },
    { pose: 'pointing', usedFor: 'Pointing off-screen' },
    { pose: 'pointing-down', usedFor: 'Marketing CTA (mdx CTA on compare and send-to pages)' },
    { pose: 'sad', usedFor: 'Errors' },
    { pose: 'walking', usedFor: 'Physical card on the way' },
    { pose: 'waving-hello', usedFor: 'Greetings, setup' },
    { pose: 'worried', usedFor: 'Errors, empty states' },
]

export interface ArtEntry {
    label: string
    asset: StaticImageData
    /** path under src/, for the caption and the import */
    path: string
    usedIn: string
}

/** Art served from public/, referenced by URL and rendered unoptimized. */
export interface PublicArtEntry {
    label: string
    src: string
    usedIn: string
}

/** The two mascot stills approved in the Oct 2026 review. Everything else mascot is a Lottie pose. */
export const MASCOT_STILL_ENTRIES: ArtEntry[] = [
    {
        label: 'peanut-club',
        asset: PEANUTMAN_MOBILE,
        path: 'assets/mascot/peanut-club.webp',
        usedIn: 'PEANUTMAN_MOBILE: app-install banner (useHomeCarouselCTAs), MigrationHero',
    },
    {
        label: 'peanut-sitting',
        asset: PEANUT_SITTING,
        path: 'assets/mascot/peanut-sitting.webp',
        usedIn: 'PEANUT_SITTING: PeanutMascotScene',
    },
]

/** Hero artwork. The Knerd key visual on the landing hero. */
export const HERO_ART_ENTRIES: ArtEntry[] = [
    {
        label: 'global-cash-local-feel',
        asset: globalCashLocalFeel,
        path: 'assets/illustrations/global-cash-local-feel.png',
        usedIn: 'Landing hero (home, /lp) — the key visual',
    },
]

/** Doodles. One sparkle: brand yellow with a black outline. */
export const DOODLE_ENTRIES: ArtEntry[] = [
    {
        label: 'star',
        asset: star,
        path: 'assets/illustrations/star.svg',
        usedIn: 'Stars/ProseStars mdx, ExchangeWidget, sendInSeconds, RegulatedRails, noFees, Manteca',
    },
    {
        label: 'sparkle',
        asset: sparkle,
        path: 'assets/illustrations/sparkle.svg',
        usedIn: '/shhhhh, merchant end fold',
    },
    { label: 'stack-coin', asset: stackCoin, path: 'assets/illustrations/stack-coin.svg', usedIn: 'ProblemFold' },
    {
        label: 'peanut-card-hand',
        asset: peanutCardHand,
        path: 'assets/cards/peanut-card-hand.svg',
        usedIn: 'Card share asset (PixelatedCardFace)',
    },
    {
        label: 'exclamations',
        asset: exclamations,
        path: 'assets/illustrations/exclamations.svg',
        usedIn: 'sendInSeconds',
    },
    { label: 'eyes', asset: eyes, path: 'assets/illustrations/eyes.svg', usedIn: 'Landing FAQ fold' },
    {
        label: 'scribble-circle',
        asset: scribbleCircle,
        path: 'assets/illustrations/scribble-circle.svg',
        usedIn: 'noFees',
    },
    {
        label: 'border-cloud',
        asset: borderCloud,
        path: 'assets/illustrations/border-cloud.svg',
        usedIn: 'CloudsCss drifting clouds: landing hero, sendInSeconds, RegulatedRails, noFees, MarketingHero, mdx Steps, ExchangeWidget, Manteca (desktop)',
    },
]

/** Landing illustrations. Multicolour, so not doodles by the fill rule; approved as they are. */
export const LANDING_ILLUSTRATION_ENTRIES: ArtEntry[] = [
    { label: 'flag-ar', asset: flagAr, path: 'assets/illustrations/flag-ar.svg', usedIn: 'Manteca fold (Argentina)' },
    { label: 'flag-br', asset: flagBr, path: 'assets/illustrations/flag-br.svg', usedIn: 'Manteca fold (Brazil)' },
    {
        label: 'landing-countries',
        asset: landingCountries,
        path: 'assets/illustrations/landing-countries.svg',
        usedIn: 'yourMoney fold (countries map)',
    },
]

/** Gloves. Flat white with a black outline, no shading. */
export const GLOVE_ENTRIES: ArtEntry[] = [
    {
        label: 'hand-peace',
        asset: handPeace,
        path: 'assets/illustrations/hand-peace.svg',
        usedIn: 'FooterChrome hand row (every marketing page)',
    },
    {
        label: 'hand-waving',
        asset: handWaving,
        path: 'assets/illustrations/hand-waving.svg',
        usedIn: 'FooterChrome hand row',
    },
    {
        label: 'hand-middle-finger',
        asset: handMiddleFinger,
        path: 'assets/illustrations/hand-middle-finger.svg',
        usedIn: 'FooterChrome hand row (easter egg)',
    },
    {
        label: 'hand-thumbs-up',
        asset: handThumbsUp,
        path: 'assets/illustrations/hand-thumbs-up.svg',
        usedIn: 'FooterChrome hand row; home marquee default image; MarketingHero/mdx Hero; securityBuiltIn icon; kyc success; PublicProfile join button',
    },
    { label: 'got-it-hand', asset: gotItHand, path: 'assets/illustrations/got-it-hand.svg', usedIn: 'Landing folds' },
    {
        label: 'got-it-hand-flipped',
        asset: gotItHandFlipped,
        path: 'assets/illustrations/got-it-hand-flipped.svg',
        usedIn: 'Landing folds',
    },
]

/**
 * Logo set. Masters in src/assets/brand; public/press/assets serves copies
 * under the press-kit names (guarded by scripts/__tests__/brand-copies.test.ts).
 */
export const LOGO_ENTRIES: ArtEntry[] = [
    {
        label: 'logo',
        asset: LOGO,
        path: 'assets/brand/logo.svg',
        usedIn: 'Icon mark. App chrome (Loading, QRScanner, TransactionCard/Header, CardFace, PixelatedCardFace), join/claim CTAs (SendWithPeanutCta, CreateAccountButton, ConfirmInviteModal, NoMoreJailDrawer, Claim link views, PublicProfile), badge fallback, FooterChrome; press kit copy Peanut_Icon.svg',
    },
    {
        label: 'wordmark',
        asset: WORDMARK,
        path: 'assets/brand/wordmark.svg',
        usedIn: 'Text only, black; tint in CSS (FooterChrome inverts it on the black band). CardFace, PublicReceiptIssuer, join/claim CTAs, PublicProfile; press kit copy Peanut_Wordmark.svg',
    },
    {
        label: 'logo-lockup',
        asset: LOGO_LOCKUP,
        path: 'assets/brand/logo-lockup.svg',
        usedIn: 'Icon + wordmark. Press kit copy Peanut_Full_Logotype.svg',
    },
]

/** The eight no-banking territories, straight from the drawer's own map. */
export const EASTER_EGG_ENTRIES: PublicArtEntry[] = Object.entries(EASTER_EGG_COUNTRIES).map(([code, country]) => ({
    label: code,
    src: country.image,
    usedIn: 'EasterEggDrawer',
}))

export const EASTER_EGG_RULE =
    'Hidden easter eggs: the eight no-banking territories get an illustration in EasterEggDrawer. Explicit exception to the design-system asset rules — approved as they are, not restyled to the doodle or glove rules, never reused outside that drawer.'

/**
 * Avatars. Basics and badge-unlocked poses mirror the API manifest
 * badge-assets.json (regenerated by `pnpm badge:check --write-manifest` in
 * peanut-api-ts); the a–z letters come from avatar.utils LETTERS, the art
 * everyone has. Nothing is listed twice by hand.
 */
export const AVATAR_BASIC_ENTRIES: PublicArtEntry[] = badgeAssets.avatars.basics.map((slug) => ({
    label: slug,
    src: avatarSrc(`basic.${slug}`)!,
    usedIn: 'every user',
}))

export const AVATAR_LETTER_ENTRIES: PublicArtEntry[] = LETTERS.map((letter) => ({
    label: letter,
    src: avatarSrc(`letter.${letter}`)!,
    usedIn: 'day-0 initial',
}))

export interface AvatarBadgeEntry {
    code: string
    slugs: string[]
    sample: string
}

export const AVATAR_BADGE_ENTRIES: AvatarBadgeEntry[] = Object.entries(badgeAssets.avatars.badges)
    .filter(([, slugs]) => slugs.length > 0)
    .map(([code, slugs]) => ({ code, slugs, sample: avatarSrc(`badge.${code}.${slugs[0]}`)! }))

export interface BadgeEntry {
    src: string
    codes: string[]
}

/**
 * Production badges from the manifest, grouped by file: two pairs of codes
 * share one file (CARD_PIONEER/FOUNDING_PIONEER, BUG_WHISPERER/SUPPORT_SURVIVOR).
 */
export const BADGE_ENTRIES: BadgeEntry[] = Array.from(
    Object.entries(badgeAssets.assets).reduce((bySrc, [code, src]) => {
        bySrc.set(src, [...(bySrc.get(src) ?? []), code])
        return bySrc
    }, new Map<string, string[]>()),
    ([src, codes]) => ({ src, codes })
)

export const TIER_BADGE_ENTRIES: ArtEntry[] = [0, 1, 2, 3].map((tier) => ({
    label: `tier${tier}`,
    asset: getTierBadge(tier),
    path: `assets/badges/tier${tier}.svg`,
    usedIn: 'Rewards points tier',
}))
