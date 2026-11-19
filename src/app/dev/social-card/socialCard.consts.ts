/**
 * The default link-preview card (public/metadata-img.png) is a screenshot of
 * /dev/social-card, taken by scripts/render-social-card.mjs. The mascot is one
 * held frame of the approved walking loop, rendered by lottie-web as it is.
 * Each variant is one candidate frame and placement; `SOCIAL_CARD_DEFAULT` is
 * the one the shipped PNG shows.
 */
export const SOCIAL_CARD_SIZE = { width: 1200, height: 630 } as const

export interface SocialCardVariant {
    /** Frame of walking.json to hold (30 fps, 40 frames). */
    frame: number
    /**
     * Box on the card the mascot's artwork is fitted into, px. The walking
     * loop's art box (MASCOT_ART_BOXES.walking, overflow included) is scaled to
     * fit inside it and centred, so no hand or shoe can leave the card.
     */
    box: { left: number; top: number; width: number; height: number }
}

// Each candidate differs in frame and placement. All boxes stay at least
// 20 px inside the card's right and bottom edges.
export const SOCIAL_CARD_VARIANTS = {
    a: { frame: 0, box: { left: 740, top: 40, width: 420, height: 560 } },
    b: { frame: 10, box: { left: 760, top: 60, width: 390, height: 520 } },
    c: { frame: 20, box: { left: 720, top: 30, width: 460, height: 580 } },
} as const satisfies Record<string, SocialCardVariant>

export type SocialCardVariantKey = keyof typeof SOCIAL_CARD_VARIANTS

export const SOCIAL_CARD_DEFAULT: SocialCardVariantKey = 'a'
