// Marketing asset inventory (drift-audit rulings of 2026-10-14/15).
// Mascot palettes were re-verified against the shipped Lottie fills on this
// branch (2026-10-15) — 4 poses already sit on the brand tokens, 6 still carry
// the old export palette. Hex literals here are DATA (what the files contain
// today and what the book shipped), not styling; the ruled targets resolve
// from tokens.generated on the page.

import type { StaticImageData } from 'next/image'
import type { MascotPose } from '@/components/Global/PeanutMascot/PeanutMascot.types'

import peanutCardHand from '@/assets/cards/peanut-card-hand.svg'
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

export type MascotStatus = 'on-brand' | 'pending recolour'

export interface MascotEntry {
    pose: MascotPose
    status: MascotStatus
    /** non-black/white fills found in the shipped comp (verified 2026-10-15) */
    fills: string[]
    usedFor: string
}

/**
 * All 10 canonical poses (the deprecated juggling Lottie is out of brand —
 * Hugo, 2026-10-10 — and stays off this page). Ruling (mascot-palette A): every
 * pose is on the brand tokens (recoloured 2026-10-15, ds-marketing-art, in
 * step with the canonical set in mono/assets — recolour at the source or the
 * next re-export reverts). Pink sneakers are canon across the whole set (k6).
 */
export const MASCOT_ENTRIES: MascotEntry[] = [
    {
        pose: 'waving-chill',
        status: 'on-brand',
        fills: ['#ff90e8', '#ffc900'],
        usedFor: 'The landing hero (ruled keep, k7); chill, effortless moments',
    },
    {
        pose: 'cheering',
        status: 'on-brand',
        fills: ['#ffc900', '#ff90e8', '#ea8282', '#ffcccc'],
        usedFor: 'Big money wins — claim and payment success',
    },
    {
        pose: 'thinking',
        status: 'on-brand',
        fills: ['#ffc900', '#ff90e8', '#ffd3b4'],
        usedFor: 'Loading and verification waits',
    },
    {
        pose: 'too-cool',
        status: 'on-brand',
        fills: ['#ffc900', '#ff90e8', '#ea8282', '#ffcccc', '#ffd3b4'],
        usedFor: 'Confident flex moments',
    },
    {
        pose: 'pointing',
        status: 'on-brand',
        fills: ['#ffc900', '#ff90e8', '#ea8282'],
        usedFor: 'Grinning, pointing off-screen',
    },
    {
        pose: 'pointing-down',
        status: 'on-brand',
        fills: ['#ffc900', '#ff90e8', '#ea8282', '#ffcccc'],
        usedFor: 'Marketing CTA (mdx CTA on compare/send-to pages)',
    },
    {
        pose: 'sad',
        status: 'on-brand',
        fills: ['#ffc900', '#ff90e8'],
        usedFor: 'Errors — slumped and dejected',
    },
    {
        pose: 'walking',
        status: 'on-brand',
        fills: ['#ffc900', '#ff90e8', '#ea8282', '#ffcccc'],
        usedFor: 'Physical-card waitlist — on the way / shipping',
    },
    {
        pose: 'waving-hello',
        status: 'on-brand',
        fills: ['#ffc900', '#ff90e8', '#ea8282', '#ffcccc'],
        usedFor: 'Greetings and setup',
    },
    {
        pose: 'worried',
        status: 'on-brand',
        fills: ['#ffc900', '#ff90e8', '#46acff'],
        usedFor: 'Errors and empty states — hands to face',
    },
]

export type DoodleStatus = 'canon' | 'pending recolour' | 'pending flatten'

export interface DoodleEntry {
    label: string
    asset: StaticImageData
    /** path under src/, for the caption — the svg itself is never opened */
    path: string
    status: DoodleStatus
    /** notable fills greped from the file (2026-10-15) */
    fills: string
    usedIn: string
}

/**
 * Doodles. Ruling (doodle-palette A, applied 2026-10-15 by ds-marketing-art):
 * ONE four-point sparkle, brand yellow #FFC900 with a black outline; the
 * near-miss yellows (#ffd25c, #ffca05) are gone.
 */
export const DOODLE_ENTRIES: DoodleEntry[] = [
    {
        label: 'star',
        asset: star,
        path: 'assets/illustrations/star.svg',
        status: 'canon',
        fills: '#FFC900, black outline',
        usedIn: 'Stars/ProseStars mdx, ExchangeWidget, sendInSeconds, RegulatedRails, noFees, Manteca',
    },
    {
        label: 'sparkle',
        asset: sparkle,
        path: 'assets/illustrations/sparkle.svg',
        status: 'canon',
        fills: '#FFC900, black outline',
        usedIn: '/shhhhh and the merchant end fold — THE sparkle',
    },
    {
        label: 'stack-coin',
        asset: stackCoin,
        path: 'assets/illustrations/stack-coin.svg',
        status: 'canon',
        fills: '#FFC900 coins',
        usedIn: 'ProblemFold',
    },
    {
        label: 'peanut-card-hand',
        asset: peanutCardHand,
        path: 'assets/cards/peanut-card-hand.svg',
        status: 'canon',
        fills: '#FFC900 sleeve',
        usedIn: 'Card share asset (PixelatedCardFace)',
    },
    {
        label: 'exclamations',
        asset: exclamations,
        path: 'assets/illustrations/exclamations.svg',
        status: 'canon',
        fills: 'black only',
        usedIn: 'sendInSeconds',
    },
    {
        label: 'eyes',
        asset: eyes,
        path: 'assets/illustrations/eyes.svg',
        status: 'canon',
        fills: 'black/white',
        usedIn: 'Landing FAQ fold',
    },
    {
        label: 'scribble-circle',
        asset: scribbleCircle,
        path: 'assets/illustrations/scribble-circle.svg',
        status: 'canon',
        fills: 'black stroke',
        usedIn: 'noFees',
    },
]

export interface GloveEntry {
    label: string
    asset: StaticImageData
    path: string
    status: DoodleStatus
    fills: string
    usedIn: string
}

/**
 * Gloves. Ruling (glove-style A, applied 2026-10-15 by ds-marketing-art):
 * flat white/black only — the #aba99b shading is gone from the shaded three.
 */
export const GLOVE_ENTRIES: GloveEntry[] = [
    {
        label: 'hand-peace',
        asset: handPeace,
        path: 'assets/illustrations/hand-peace.svg',
        status: 'canon',
        fills: 'flat white/black',
        usedIn: 'FooterChrome hand row (every marketing page)',
    },
    {
        label: 'hand-waving',
        asset: handWaving,
        path: 'assets/illustrations/hand-waving.svg',
        status: 'canon',
        fills: 'flat white/black',
        usedIn: 'FooterChrome hand row',
    },
    {
        label: 'hand-middle-finger',
        asset: handMiddleFinger,
        path: 'assets/illustrations/hand-middle-finger.svg',
        status: 'canon',
        fills: 'flat white/black',
        usedIn: 'FooterChrome hand row (easter egg)',
    },
    {
        label: 'hand-thumbs-up',
        asset: handThumbsUp,
        path: 'assets/illustrations/hand-thumbs-up.svg',
        status: 'canon',
        fills: 'flat white/black',
        usedIn: 'FooterChrome hand row; the home marquee default image',
    },
    {
        label: 'got-it-hand',
        asset: gotItHand,
        path: 'assets/illustrations/got-it-hand.svg',
        status: 'canon',
        fills: 'flat white/black',
        usedIn: 'Landing folds',
    },
    {
        label: 'got-it-hand-flipped',
        asset: gotItHandFlipped,
        path: 'assets/illustrations/got-it-hand-flipped.svg',
        status: 'canon',
        fills: 'flat white/black',
        usedIn: 'Landing folds',
    },
]
