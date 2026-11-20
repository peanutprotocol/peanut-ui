import type { MascotPose } from '@/components/Global/PeanutMascot/PeanutMascot.types'

/**
 * The default link-preview card (public/metadata-img.png) is a screenshot of
 * /dev/social-card, taken by scripts/render-social-card.mjs. The card only
 * places approved files (a held frame of a mascot pose, the logo lockup, the
 * star doodle) next to copy set in Roboto Flex and `Title`. Each variant is
 * one option for Konrad to pick; `SOCIAL_CARD_DEFAULT` is the one the shipped
 * PNG shows.
 *
 * Copy comes from mono content/_system/context/messaging.md (tagline,
 * homepage subline, store subtitle, acquisition headline), split into a Roboto
 * lead and a Knerd accent the way the homepage hero sets it.
 */
export const SOCIAL_CARD_SIZE = { width: 1200, height: 630 } as const

/** A box on the card, px. */
export interface SocialCardBox {
    left: number
    top: number
    width: number
    height: number
}

/** One headline row: a Roboto Flex lead over a Knerd accent of 1–3 words. */
export interface SocialCardPhrase {
    lead: string
    /** Knerd words; "\n" places lines by hand, as in `Title`. */
    accent?: string
}

export type SocialCardArt =
    /**
     * One held frame of an approved pose. The pose's art box is scaled to fit
     * inside `box` and centred, so no hand or shoe leaves the card.
     */
    | { kind: 'pose'; pose: MascotPose; frame: number; box: SocialCardBox }
    /** The logo lockup above the copy, `width` px wide; no mascot. */
    | { kind: 'logo'; width: number }

export interface SocialCardVariant {
    art: SocialCardArt
    /** The column the copy is centred in; it spans the card's full height. */
    copy: { left: number; width: number }
    phrases: readonly SocialCardPhrase[]
    subline?: string
    /** Lead and accent side by side, as the homepage hero sets them from 768 px; otherwise stacked. */
    rows?: boolean
    leadSize: number
    accentSize: number
    /** Star doodles, as on the homepage hero: top-left corner and width, px. */
    stars?: readonly { left: number; top: number; width: number }[]
}

const TAGLINE = [
    { lead: 'Get paid', accent: 'GLOBALLY' },
    { lead: 'Spend', accent: 'LOCALLY' },
] as const
const STORE_SUBTITLE = [{ lead: 'Get paid.' }, { lead: 'Spend', accent: 'LOCALLY' }] as const
const ACQUISITION = [{ lead: 'Get paid from the', accent: 'US AND\nEUROPE' }] as const
const SUBLINE = 'Receive dollars and euros. Pay by card or QR.'

// Mascot on the right: copy in the left 680 px. Boxes stay 20 px inside the card.
const LEFT_COPY = { left: 40, width: 680 } as const
const RIGHT_BOX = { left: 700, top: 40, width: 460, height: 560 } as const
// waving-chill is a wide pose; a wider box keeps it as tall as the others.
const RIGHT_BOX_WIDE = { left: 690, top: 40, width: 490, height: 560 } as const

export const SOCIAL_CARD_VARIANTS = {
    o1: {
        art: { kind: 'pose', pose: 'waving-chill', frame: 0, box: RIGHT_BOX_WIDE },
        copy: LEFT_COPY,
        phrases: TAGLINE,
        leadSize: 68,
        accentSize: 130,
        stars: [
            { left: 60, top: 90, width: 40 },
            { left: 660, top: 480, width: 40 },
        ],
    },
    o2: {
        art: { kind: 'pose', pose: 'waving-chill', frame: 0, box: RIGHT_BOX_WIDE },
        copy: LEFT_COPY,
        phrases: TAGLINE,
        subline: SUBLINE,
        leadSize: 60,
        accentSize: 112,
    },
    o3: {
        art: { kind: 'pose', pose: 'waving-hello', frame: 20, box: RIGHT_BOX },
        copy: LEFT_COPY,
        phrases: STORE_SUBTITLE,
        leadSize: 84,
        accentSize: 160,
    },
    o4: {
        art: { kind: 'pose', pose: 'too-cool', frame: 0, box: RIGHT_BOX },
        copy: LEFT_COPY,
        phrases: TAGLINE,
        leadSize: 68,
        accentSize: 130,
    },
    o5: {
        art: { kind: 'pose', pose: 'cheering', frame: 11, box: RIGHT_BOX },
        copy: LEFT_COPY,
        phrases: ACQUISITION,
        leadSize: 72,
        accentSize: 150,
    },
    o6: {
        art: { kind: 'pose', pose: 'pointing', frame: 0, box: { left: 40, top: 40, width: 420, height: 560 } },
        copy: { left: 460, width: 700 },
        phrases: TAGLINE,
        leadSize: 68,
        accentSize: 130,
    },
    o7: {
        art: { kind: 'pose', pose: 'waving-hello', frame: 20, box: RIGHT_BOX },
        copy: LEFT_COPY,
        phrases: ACQUISITION,
        subline: SUBLINE,
        leadSize: 64,
        accentSize: 130,
    },
    o8: {
        art: { kind: 'logo', width: 360 },
        copy: { left: 60, width: 1080 },
        phrases: TAGLINE,
        subline: SUBLINE,
        rows: true,
        leadSize: 72,
        accentSize: 120,
    },
} as const satisfies Record<string, SocialCardVariant>

export type SocialCardVariantKey = keyof typeof SOCIAL_CARD_VARIANTS

export const SOCIAL_CARD_DEFAULT: SocialCardVariantKey = 'o1'
