// Marketing asset inventory: the approved brand art — mascot, coin characters, hero art, doodles,
// gloves, logo set, link-preview doodles, app icons, easter eggs, residence stickers, avatars,
// badges — and where each piece is used.
// An asset that is not listed here is not approved. Files decided fix-later in
// the Oct 2026 sweep stay in production but are not listed.

import type { StaticImageData } from 'next/image'
import type { MascotPose } from '@/components/Global/PeanutMascot/PeanutMascot.types'
import { LOGO, LOGO_LOCKUP, WORDMARK } from '@/assets/brand'
import { PEANUTMAN_MOBILE, PEANUT_SITTING } from '@/assets/mascot'
import { EASTER_EGG_COUNTRIES } from '@/components/Global/EasterEggDrawer/easter-egg-countries.consts'
import { RESIDENCE_STICKERS, residenceStickerSrc } from '@/components/Setup/components/residence-stickers.consts'
import { LETTERS, avatarSrc } from '@/components/Avatar/avatar.utils'
import { getTierBadge } from '@/features/rewards/utils'
import badgeAssets from '@/types/badge-assets.json'

import peanutCardHand from '@/assets/cards/peanut-card-hand.svg'
import europeGlobe from '@/assets/icons/europe-globe.svg'
import latamGlobe from '@/assets/icons/latam-globe.svg'
import northAmericaGlobe from '@/assets/icons/north-america-globe.svg'
import restOfWorldGlobe from '@/assets/icons/rest-of-world-globe.svg'
import starStraight from '@/assets/icons/starStraight.svg'
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
import coinEurFace from '@/assets/onboarding/coin-eur-face.svg'
import coinEurRig from '@/assets/onboarding/coin-eur-rig.png'
import coinUsdFace from '@/assets/onboarding/coin-usd-face.svg'
import coinUsdRig from '@/assets/onboarding/coin-usd-rig.png'
import firstInviteWhite from '@/assets/onboarding/first-invite-white.svg'

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
        usedIn: 'PEANUT_SITTING: creator invite page A1 (NitaA1), the still behind the pointing-down loop on creator pages A1 and E1 (CreatorPageMascot), DS receipt card fan demo (ReceiptCardFan). It must always sit on a horizontal divider or edge, seat on the line; it never floats.',
    },
]

/**
 * Press kit stills: one 320 px render of an approved pose each, served as
 * downloads on the press page. Approved by Konrad, 2026-11-19.
 */
export const PRESS_STILL_ENTRIES: PublicArtEntry[] = [
    ['peanut-waving-hello', 'waving-hello'],
    ['peanut-cool', 'too-cool'],
    ['peanut-walking', 'walking'],
    ['peanut-pointing-down', 'pointing-down'],
    ['peanut-worried', 'worried'],
].map(([file, pose]) => ({
    label: file,
    src: `/press/assets/mascots/${file}.webp`,
    usedIn: `Press kit download only; still of the ${pose} pose`,
}))

/**
 * The coin characters: the $ and € coin faces of sign-up. Approved by Konrad,
 * 2026-11-19.
 */
export const COIN_ENTRIES: ArtEntry[] = [
    {
        label: 'coin-usd-face',
        asset: coinUsdFace,
        path: 'assets/onboarding/coin-usd-face.svg',
        usedIn: 'Sign-up Welcome coin row (X1Hero); the corner coins on the US/Europe accounts landing page; permitted celebrations "Coins land, get stacked" and "One coin flip"',
    },
    {
        label: 'coin-eur-face',
        asset: coinEurFace,
        path: 'assets/onboarding/coin-eur-face.svg',
        usedIn: 'Sign-up Welcome coin row (X1Hero); the corner coins on the US/Europe accounts landing page; permitted celebrations "Coins land, get stacked" and "One coin flip"',
    },
    {
        label: 'coin-usd-rig',
        asset: coinUsdRig,
        path: 'assets/onboarding/coin-usd-rig.png',
        usedIn: 'CoinCharacter still: sign-up Accounts, Payment plan, Final confirm, Celebration',
    },
    {
        label: 'coin-eur-rig',
        asset: coinEurRig,
        path: 'assets/onboarding/coin-eur-rig.png',
        usedIn: 'CoinCharacter still: sign-up Accounts, Payment plan, Final confirm, Celebration',
    },
]

export const COIN_RULE =
    'These coin faces are the only coin art. The moving coins are cut from the Accounts loop (assets/onboarding/accounts.json, shown below) by coinRig.ts, and the desktop sign-up side loops use the same coins. Approved by Konrad, 2026-11-19.'

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
        usedIn: 'Stars/ProseStars mdx, ExchangeWidget, ProductSplitHero, star confetti (utils/confetti)',
    },
    {
        label: 'sparkle',
        asset: sparkle,
        path: 'assets/illustrations/sparkle.svg',
        usedIn: 'ProductSplitHero, StarLp CloseFold, self-custody, home card fold',
    },
    {
        label: 'stack-coin',
        asset: stackCoin,
        path: 'assets/illustrations/stack-coin.svg',
        usedIn: 'Pot status line at 18 px (PotProgress: "Goal achieved!", "Goal exceeded!" and the below-goal line on a closed pot); permitted celebration "Coins land, get stacked"',
    },
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
        usedIn: 'RequestLinksExclamations',
    },
    { label: 'eyes', asset: eyes, path: 'assets/illustrations/eyes.svg', usedIn: 'no current call site' },
    {
        label: 'scribble-circle',
        asset: scribbleCircle,
        path: 'assets/illustrations/scribble-circle.svg',
        usedIn: 'KnerdWordCircle (star-LP close)',
    },
    {
        label: 'border-cloud',
        asset: borderCloud,
        path: 'assets/illustrations/border-cloud.svg',
        usedIn: 'CloudsCss drifting clouds: landing hero, home get-paid and request folds, MarketingHero, mdx Hero/Steps, ExchangeWidget, us-europe-accounts, request-links',
    },
]

/** Landing illustrations. Multicolour, so not doodles by the fill rule; approved as they are. */
export const LANDING_ILLUSTRATION_ENTRIES: ArtEntry[] = [
    { label: 'flag-ar', asset: flagAr, path: 'assets/illustrations/flag-ar.svg', usedIn: 'no current call site' },
    { label: 'flag-br', asset: flagBr, path: 'assets/illustrations/flag-br.svg', usedIn: 'no current call site' },
    {
        label: 'landing-countries',
        asset: landingCountries,
        path: 'assets/illustrations/landing-countries.svg',
        usedIn: 'no current call site',
    },
]

/**
 * Link-preview doodles: the scribble loop and the arrows on the Open Graph
 * cards. Served from public/ because next/og loads them by URL. Approved by
 * Konrad, 2026-11-19, for that use only.
 */
export const OG_DOODLE_ENTRIES: PublicArtEntry[] = [
    ['scribble', '/scribble.svg', 'Scribble loop around the username: payment, invite and profile cards'],
    ['top-left-arrows', '/arrows/top-left-arrows.svg', 'Payment card and invite card'],
    ['top-right-arrow', '/arrows/top-right-arrow.svg', 'Payment card'],
    ['top-right-arrow-2', '/arrows/top-right-arrow-2.svg', 'Invite card'],
    ['bottom-left-arrow', '/arrows/bottom-left-arrow.svg', 'Payment card'],
    ['bottom-right-arrow', '/arrows/bottom-right-arrow.svg', 'Payment card'],
].map(([label, src, usedIn]) => ({ label, src, usedIn }))

export const OG_DOODLE_RULE =
    'Link-preview cards only (src/components/og, served by /api/og). Do not use the scribble or the arrows on an app screen, a marketing page or in new art; use scribble-circle and the doodles above there. Approved by Konrad, 2026-11-19, with this limit.'

/**
 * App icons that are pictures, not Lucide glyphs. Each has one job. Approved
 * by Konrad, 2026-11-19.
 */
export const APP_ICON_ENTRIES: ArtEntry[] = [
    {
        label: 'starStraight',
        asset: starStraight,
        path: 'assets/icons/starStraight.svg',
        usedIn: 'The points icon, and nothing else: next to a points number or the Points and Rewards entries',
    },
    {
        label: 'europe-globe',
        asset: europeGlobe,
        path: 'assets/icons/europe-globe.svg',
        usedIn: 'Region icon: Profile > Limits, Europe row',
    },
    {
        label: 'north-america-globe',
        asset: northAmericaGlobe,
        path: 'assets/icons/north-america-globe.svg',
        usedIn: 'Region icon: Profile > Limits, North America row',
    },
    {
        label: 'latam-globe',
        asset: latamGlobe,
        path: 'assets/icons/latam-globe.svg',
        usedIn: 'Region icon: Profile > Limits, LATAM row',
    },
    {
        label: 'rest-of-world-globe',
        asset: restOfWorldGlobe,
        path: 'assets/icons/rest-of-world-globe.svg',
        usedIn: 'Region icon: Profile > Limits, Rest of the world row',
    },
]

/** The invite heart is an inline icon component, so the page renders it through Icon. */
export const INVITE_HEART_ENTRY = {
    label: 'invite-heart',
    path: 'components/Global/Icons/invite-heart.tsx',
    usedIn: 'Invite buttons and invite rows: profile header, Rewards, QR pay success, receipt referral action. Also the charitable donations answer in the paperwork questions',
}

export const APP_ICON_RULE =
    'Functional icons, approved as they are. The four globes work like country flags and keep their own colours. None of them is a doodle or a sticker; do not use them as decoration.'

/** Gloves. Flat white with a black outline, no shading. */
export const GLOVE_ENTRIES: ArtEntry[] = [
    {
        label: 'hand-peace',
        asset: handPeace,
        path: 'assets/illustrations/hand-peace.svg',
        usedIn: 'FooterChrome hand row (every marketing page), StarLp CloseGloveCta (home and us-europe-accounts close)',
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
 * Residence stickers: three per country for 20 countries, straight from the
 * hero's own map. Approved by Konrad, 2026-11-15 (TASK-24899).
 */
export const RESIDENCE_STICKER_ENTRIES: PublicArtEntry[] = Object.entries(RESIDENCE_STICKERS).flatMap(([code, files]) =>
    files.map((file) => ({
        label: `${code} ${file.slice(3, -5)}`,
        src: residenceStickerSrc(file),
        usedIn: 'ResidenceHero, sign-up Residence step',
    }))
)

export const RESIDENCE_STICKER_RULE =
    'Sign-up Residence easter egg: a resident of one of 20 countries gets three local stickers slapped around the cheering mascot, with the landing star and sparkle. Generated art in the sticker style; used only on that screen. Approved by Konrad, 2026-11-15.'

/**
 * Avatars. Basics and badge avatars mirror the API manifest
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

/**
 * Badge avatars: exactly one per badge, drawn to read at 32 px. Approved by
 * Konrad, 2026-11-04 (TASK-24388). Mirrors the manifest, so a badge without art
 * lists nothing.
 */
export const AVATAR_BADGE_RULE = 'One avatar per badge, drawn to read at 32 px. Approved by Konrad, 2026-11-04.'

/** The two avatar sizes (TASK-24388), the AvatarSize type in avatar-size.consts.ts. */
export const AVATAR_SIZE_RULE =
    "Avatars have two sizes: 32 px (s) in every list, row, card and confirm card, and 96 px (xl) on profiles (your own, the profile-tab button, and someone else's) and in the payment details header. The avatar picker tiles keep their own size. Approved by Konrad, 2026-11-04."

export const AVATAR_BADGE_ENTRIES: PublicArtEntry[] = Object.entries(badgeAssets.avatars.badges).flatMap(
    ([code, slugs]) =>
        slugs.map((slug) => ({
            label: `badge.${code}.${slug}`,
            src: avatarSrc(`badge.${code}.${slug}`)!,
            usedIn: 'Badge avatar, one per badge, reads at 32 px',
        }))
)

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

/** Colour variants of a production badge, approved for one named use each. */
export const BADGE_VARIANT_ENTRIES: ArtEntry[] = [
    {
        label: 'first-invite-white',
        asset: firstInviteWhite,
        path: 'assets/onboarding/first-invite-white.svg',
        usedIn: 'White-paper variant of the first_invite badge, for coloured panels: sign-up Email step (EmailArt)',
    },
]

/**
 * Production badge files with one more named use outside the badge set.
 * Approved by Konrad, 2026-11-20.
 */
export const BADGE_REUSE_ENTRIES: PublicArtEntry[] = [
    {
        label: 'mini_influencer',
        src: '/badges/mini_influencer.svg',
        usedIn: "The megaphone next to the waving mascot on the 'Get money alerts' prompt (PeanutMascotScene, SetupNotificationsModal)",
    },
]

/**
 * Art outside the web app that Konrad approved as it is. Each is an exception:
 * it is not redrawn to the house style and not reused anywhere else.
 */
export const NATIVE_ART_EXCEPTION_ENTRIES = [
    {
        label: 'wallet-card-artwork',
        path: 'ios/App/App/WalletCardArtwork.swift',
        usedIn: 'iPhone Wallet, "From Apps on Your iPhone" list: the picture next to the Peanut card (IssuerExtensionHandler). Drawn by UIKit at 160 x 160; there is no image file, so this page does not show it.',
    },
]

export const NATIVE_ART_EXCEPTION_RULE =
    'Approved exception: keep the iPhone Wallet card picture exactly as it is today. Do not change it and do not copy it to another surface. Approved by Konrad, 2026-11-20.'

export const TIER_BADGE_ENTRIES: ArtEntry[] = [0, 1, 2, 3].map((tier) => ({
    label: `tier${tier}`,
    asset: getTierBadge(tier),
    path: `assets/badges/tier${tier}.svg`,
    usedIn: 'Rewards points tier',
}))
