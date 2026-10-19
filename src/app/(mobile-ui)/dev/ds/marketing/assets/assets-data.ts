// Marketing asset inventory: the approved brand art, the fills each file
// carries and where it is used. Hex literals here are DATA (what the files
// contain), not styling; the brand tokens resolve from tokens.generated on the
// page.

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

export interface MascotEntry {
    pose: MascotPose
    /** non-black/white fills in the shipped comp */
    fills: string[]
    usedFor: string
}

/**
 * All 10 canonical poses (the deprecated juggling Lottie is out of brand and
 * stays off this page). Every pose is on the brand tokens, generated from the
 * canonical set in mono/assets — recolour at the source or the next re-export
 * reverts. Pink sneakers are canon across the whole set.
 */
export const MASCOT_ENTRIES: MascotEntry[] = [
    {
        pose: 'waving-chill',
        fills: ['#ff90e8', '#ffc900'],
        usedFor: 'The landing hero; chill, effortless moments',
    },
    {
        pose: 'cheering',
        fills: ['#ffc900', '#ff90e8', '#ea8282', '#ffcccc'],
        usedFor: 'Big money wins — claim and payment success',
    },
    {
        pose: 'thinking',
        fills: ['#ffc900', '#ff90e8', '#ffd3b4'],
        usedFor: 'Loading and verification waits',
    },
    {
        pose: 'too-cool',
        fills: ['#ffc900', '#ff90e8', '#ea8282', '#ffcccc', '#ffd3b4'],
        usedFor: 'Confident flex moments',
    },
    {
        pose: 'pointing',
        fills: ['#ffc900', '#ff90e8', '#ea8282'],
        usedFor: 'Grinning, pointing off-screen',
    },
    {
        pose: 'pointing-down',
        fills: ['#ffc900', '#ff90e8', '#ea8282', '#ffcccc'],
        usedFor: 'Marketing CTA (mdx CTA on compare/send-to pages)',
    },
    {
        pose: 'sad',
        fills: ['#ffc900', '#ff90e8'],
        usedFor: 'Errors — slumped and dejected',
    },
    {
        pose: 'walking',
        fills: ['#ffc900', '#ff90e8', '#ea8282', '#ffcccc'],
        usedFor: 'Physical-card waitlist — on the way / shipping',
    },
    {
        pose: 'waving-hello',
        fills: ['#ffc900', '#ff90e8', '#ea8282', '#ffcccc'],
        usedFor: 'Greetings and setup',
    },
    {
        pose: 'worried',
        fills: ['#ffc900', '#ff90e8', '#46acff'],
        usedFor: 'Errors and empty states — hands to face',
    },
]

export interface DoodleEntry {
    label: string
    asset: StaticImageData
    /** path under src/, for the caption — the svg itself is never opened */
    path: string
    /** notable fills in the file */
    fills: string
    usedIn: string
}

/**
 * Doodles. ONE four-point sparkle, brand yellow #FFC900 with a black outline;
 * no near-miss yellows.
 */
export const DOODLE_ENTRIES: DoodleEntry[] = [
    {
        label: 'star',
        asset: star,
        path: 'assets/illustrations/star.svg',
        fills: '#FFC900, black outline',
        usedIn: 'Stars/ProseStars mdx, ExchangeWidget, sendInSeconds, RegulatedRails, noFees, Manteca',
    },
    {
        label: 'sparkle',
        asset: sparkle,
        path: 'assets/illustrations/sparkle.svg',
        fills: '#FFC900, black outline',
        usedIn: '/shhhhh and the merchant end fold — THE sparkle',
    },
    {
        label: 'stack-coin',
        asset: stackCoin,
        path: 'assets/illustrations/stack-coin.svg',
        fills: '#FFC900 coins',
        usedIn: 'ProblemFold',
    },
    {
        label: 'peanut-card-hand',
        asset: peanutCardHand,
        path: 'assets/cards/peanut-card-hand.svg',
        fills: '#FFC900 sleeve',
        usedIn: 'Card share asset (PixelatedCardFace)',
    },
    {
        label: 'exclamations',
        asset: exclamations,
        path: 'assets/illustrations/exclamations.svg',
        fills: 'black only',
        usedIn: 'sendInSeconds',
    },
    {
        label: 'eyes',
        asset: eyes,
        path: 'assets/illustrations/eyes.svg',
        fills: 'black/white',
        usedIn: 'Landing FAQ fold',
    },
    {
        label: 'scribble-circle',
        asset: scribbleCircle,
        path: 'assets/illustrations/scribble-circle.svg',
        fills: 'black stroke',
        usedIn: 'noFees',
    },
]

export interface GloveEntry {
    label: string
    asset: StaticImageData
    path: string
    fills: string
    usedIn: string
}

/**
 * Gloves. Flat white/black only — no #aba99b shading.
 */
export const GLOVE_ENTRIES: GloveEntry[] = [
    {
        label: 'hand-peace',
        asset: handPeace,
        path: 'assets/illustrations/hand-peace.svg',
        fills: 'flat white/black',
        usedIn: 'FooterChrome hand row (every marketing page)',
    },
    {
        label: 'hand-waving',
        asset: handWaving,
        path: 'assets/illustrations/hand-waving.svg',
        fills: 'flat white/black',
        usedIn: 'FooterChrome hand row',
    },
    {
        label: 'hand-middle-finger',
        asset: handMiddleFinger,
        path: 'assets/illustrations/hand-middle-finger.svg',
        fills: 'flat white/black',
        usedIn: 'FooterChrome hand row (easter egg)',
    },
    {
        label: 'hand-thumbs-up',
        asset: handThumbsUp,
        path: 'assets/illustrations/hand-thumbs-up.svg',
        fills: 'flat white/black',
        usedIn: 'FooterChrome hand row; the home marquee default image',
    },
    {
        label: 'got-it-hand',
        asset: gotItHand,
        path: 'assets/illustrations/got-it-hand.svg',
        fills: 'flat white/black',
        usedIn: 'Landing folds',
    },
    {
        label: 'got-it-hand-flipped',
        asset: gotItHandFlipped,
        path: 'assets/illustrations/got-it-hand-flipped.svg',
        fills: 'flat white/black',
        usedIn: 'Landing folds',
    },
]
