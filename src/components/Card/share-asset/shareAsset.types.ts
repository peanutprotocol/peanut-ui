/**
 * Types for the D3 share asset — the floating-collage Twitter card that
 * users post after they get their Peanut card.
 *
 * Asset spec: 1200×675 (Twitter summary_large_image). Composition layers
 * top-to-bottom by z-index: marquee/bg → behind stamps → card → front
 * stamps → tape/overlays → text anchors.
 */

/** One badge entry — shape mirrors the production `user.badges[]` from /get-user. */
export interface ShareAssetBadge {
    /** Backend badge code (e.g. "OG_2025_10_12"). Any string accepted —
     *  unknown codes fall back to the peanut logo icon. */
    code: string
    earnedAt?: string | Date
    /** Display label override. Unused by the share asset (we don't render
     *  text per stamp anymore) but kept for API compatibility. */
    name?: string
}

/** Stats block. All fields optional — the asset renders only the ones present. */
export interface ShareAssetStats {
    joinedAt?: string | Date | null
    totalMovedUsd?: number | null
    totalTxns?: number | null
    invitedCount?: number | null
}

export type TierLevel = 0 | 1 | 2 | 3

/** Visual treatment for the hero "I got in" message sticker at the top. */
export type HeroVariant = 'burst' | 'pill' | 'banner'

export interface HeroMessage {
    /** The headline copy, e.g. "I'M IN" or "shhhh, i'm in". */
    text: string
    /** Sticker shape/treatment. */
    variant: HeroVariant
    /** Size multiplier (1 = default). The builder exposes this as a slider. */
    scale?: number
    /** Tilt in degrees (clockwise). Defaults to a small per-variant lean. */
    tilt?: number
}

/** Background colour for the username pill. */
export type UsernameBg = 'white' | 'pink' | 'blue'

/** Typography + colour controls for the `peanut.me/<handle>` pill. */
export interface UsernameStyle {
    bg: UsernameBg
    /** "peanut.me/" prefix size as a fraction of the handle font size (~0.2–0.7). */
    prefixRatio?: number
    /** Handle font-size multiplier (1 = the auto-fit default). */
    scale?: number
    /** Handle letter spacing, in em. */
    letterSpacing?: number
}

export interface ShareAssetD3Props {
    /** Lowercase username, max 12 chars per current peanut constraint. */
    username: string

    /** Up to N badges. Component picks the first 6 by earnedAt-desc for layout. */
    badges: ShareAssetBadge[]

    /** Optional Wrapped-style stats. Hidden when missing/zero. */
    stats?: ShareAssetStats

    /** Points tier (0–3). Drives which tier SVG renders. */
    tier?: TierLevel

    /** Points balance — rendered as the big number next to the tier SVG. */
    pointsBalance?: number

    /** Last 4 of card PAN — rendered on the card face. */
    cardLast4?: string

    /** Optional hero "I got in" message sticker at the top. Null/omitted = none. */
    heroMessage?: HeroMessage | null

    /** Username pill colour + typography. Defaults to pink with auto-fit sizing. */
    usernameStyle?: UsernameStyle

    /**
     * Override the username-derived seed. Used by the /dev/share-builder
     * "reroll" button to dice-roll positions without changing user input.
     */
    seedOverride?: string | number

    /**
     * Animate the initial composition (stamps drop in, card slides in,
     * stats fade in). Default true on client; pass `false` for server
     * snapshots / image export so the final frame renders deterministically.
     */
    animate?: boolean
}
