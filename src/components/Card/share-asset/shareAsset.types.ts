/**
 * Types for the D3 share asset — the floating-collage Twitter card that
 * users post after they get their Peanut card.
 *
 * Asset spec: 1200×675 (Twitter summary_large_image). Composition layers
 * top-to-bottom by z-index: marquee/bg → behind stamps → card → front
 * stamps → tape/overlays → text anchors.
 */

import type { BadgeCode } from './badgeCatalog'

/** One badge entry — shape mirrors the production `user.badges[]` from /get-user. */
export interface ShareAssetBadge {
    code: BadgeCode | string
    earnedAt?: string | Date
    /** Display label override. If omitted, falls back to the catalog default. */
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
