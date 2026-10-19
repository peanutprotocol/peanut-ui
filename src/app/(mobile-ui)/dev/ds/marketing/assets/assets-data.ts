// Marketing asset inventory: the approved brand art and where each piece is
// used. An asset that is not listed here is not approved.

import type { StaticImageData } from 'next/image'
import type { MascotPose } from '@/components/Global/PeanutMascot/PeanutMascot.types'

import peanutCardHand from '@/assets/cards/peanut-card-hand.svg'
import globalCashLocalFeel from '@/assets/illustrations/global-cash-local-feel.png'
import exclamations from '@/assets/illustrations/exclamations.svg'
import eyes from '@/assets/illustrations/eyes.svg'
import gotItHand from '@/assets/illustrations/got-it-hand.svg'
import gotItHandFlipped from '@/assets/illustrations/got-it-hand-flipped.svg'
import handMiddleFinger from '@/assets/illustrations/hand-middle-finger.svg'
import handPeace from '@/assets/illustrations/hand-peace.svg'
import handThumbsUp from '@/assets/illustrations/hand-thumbs-up.svg'
import handWaving from '@/assets/illustrations/hand-waving.svg'
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
 * never the export, or the next re-export reverts it. The old juggling Lottie
 * is out of brand and stays off this page.
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
        usedIn: 'FooterChrome hand row; home marquee default image',
    },
    { label: 'got-it-hand', asset: gotItHand, path: 'assets/illustrations/got-it-hand.svg', usedIn: 'Landing folds' },
    {
        label: 'got-it-hand-flipped',
        asset: gotItHandFlipped,
        path: 'assets/illustrations/got-it-hand-flipped.svg',
        usedIn: 'Landing folds',
    },
]
