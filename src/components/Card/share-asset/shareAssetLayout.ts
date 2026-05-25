/**
 * Pure-function layout engine for the D3 share asset.
 *
 * Given the user's data (badges, stats, tier, etc.) + a deterministic
 * PRNG, returns the positions/rotations/sizes for every floating element
 * in the 1200×675 canvas. No React, no DOM — call it from a component
 * or a server-side renderer (satori/sharp) and read the result.
 *
 * Coordinate system: top/left from canvas top-left, in pixels.
 * Canvas: 1200 wide × 675 tall.
 */

import { SeededRandom } from './seededRandom'
import { getBadgeMeta } from './badgeCatalog'
import { getBadgeIcon } from '@/components/Badges/badge.utils'
import type { ShareAssetBadge, ShareAssetStats } from './shareAsset.types'

// ─── Canvas + element constants ─────────────────────────────────────────
// 4:3 — postage-stamp-ish proportions. Was 16:9 (Twitter summary_large_image)
// but the asset is no longer linked from the X intent (text-only share now),
// so the aspect ratio is a pure design call. 4:3 gives more vertical room
// for the card + username pill without crowding.
export const CANVAS_W = 1200
export const CANVAS_H = 900

// Card box (rendered with rotation around its center) — matches the
// in-app CardFace.tsx aspect ratio 1.586:1.
export const CARD_W = 620
export const CARD_H = Math.round(CARD_W / 1.586) // ≈ 391
export const CARD_LEFT = 264
// Vertically centered in the new 900-tall canvas: (900 - 391) / 2 ≈ 254.
export const CARD_TOP = 254
export const CARD_ROTATION_DEG = -8

// ─── Stamp positions ────────────────────────────────────────────────────
// Slots that stamps can land in, in priority order. Each carries a
// "behind" flag — true = z-index BELOW the card (stamp peeks out from
// behind), false = z-index ABOVE the card (stamp lands on top, overlapping).
// PRNG jiggles within `jitter` bounds.

export interface StampSlot {
    /** Anchor in canvas coords (top-left of stamp). */
    top: number
    left: number
    /** ±px wiggle applied via PRNG. */
    jitterXY: number
    /** Base rotation in deg. */
    rotation: number
    /** ±deg rotation wiggle. */
    jitterRot: number
    /** Behind the card (peeks out) or in front (overlaps card edges). */
    behind: boolean
    /** Optional: tape strip pinning the stamp. */
    withTape?: boolean
}

// Priority-ordered stamp slots. The order matters: when a user has 1
// stamp it must look intentional (hero placement, no collision with the
// username pill / EARNED / tier block). 2-3 stamps should balance. 6
// stamps fill the canvas.
//
// Excluded zones (do NOT place stamps here — they collide with fixed
// editorial chrome on the 1200×900 canvas):
//   - EARNED rubber stamp: top:0-180, right:0-300
//   - EDITION + tier block: top:0-460, left:0-360
//   - @username pill + tagline: bottom:0-220, right:0-720
//
// Slot 1 is the HERO slot for single-stamp users: behind the card,
// peeking out the top-center. Visually centered, no chrome collision.
const STAMP_SLOTS: readonly StampSlot[] = [
    // 1. HERO (behind, top-center) — peeks out from above the card.
    { top: 160, left: 504, jitterXY: 14, rotation: -12, jitterRot: 5, behind: true, withTape: true },
    // 2. Front lower-left of card — balances the @username (bottom-right).
    { top: 620, left: 132, jitterXY: 12, rotation: 12, jitterRot: 4, behind: false },
    // 3. Behind upper-right of card — fills the right side without
    //    touching EARNED.
    { top: 220, left: 820, jitterXY: 12, rotation: 16, jitterRot: 5, behind: true },
    // 4. Front mid-left — peeks at left card edge below the tier block.
    { top: 478, left: 60, jitterXY: 10, rotation: -18, jitterRot: 4, behind: false },
    // 5. Behind mid-right card — peeks from card's right side.
    { top: 470, left: 900, jitterXY: 12, rotation: 18, jitterRot: 5, behind: true },
    // 6. Front bottom — pinned LEFT (not centered) because the
    //    @username pill anchors bottom-right and its hit-box extends as
    //    far left as x≈424 for the longest 16-char usernames. Keeping
    //    slot #6 at left:140 leaves an 80px gap to the pill's worst-case
    //    left edge.
    { top: 720, left: 140, jitterXY: 10, rotation: -8, jitterRot: 4, behind: false },
] as const

export interface StampPlacement {
    badge: { code: string; caption: string; captionBg: string; iconUrl: string; year?: string }
    top: number
    left: number
    rotation: number
    behind: boolean
    withTape: boolean
    /** Size: shrinks as badge count grows (so 6 badges aren't huge). */
    width: number
    height: number
}

export function placeStamps(badges: ShareAssetBadge[], rng: SeededRandom): StampPlacement[] {
    const sorted = [...badges].sort((a, b) => {
        const aT = a.earnedAt ? new Date(a.earnedAt).getTime() : 0
        const bT = b.earnedAt ? new Date(b.earnedAt).getTime() : 0
        return bT - aT
    })
    const picked = sorted.slice(0, 6)
    const count = picked.length
    if (count === 0) return []

    // Inversely scale stamp size with count so 1-badge users see a
    // prominent stamp and 6-badge users see a balanced grid (no crowding).
    const sizeByCount: Record<number, [number, number]> = {
        1: [200, 236],
        2: [180, 212],
        3: [170, 200],
        4: [160, 188],
        5: [150, 176],
        6: [138, 162],
    }
    const [width, height] = sizeByCount[Math.min(count, 6) as 1 | 2 | 3 | 4 | 5 | 6]

    const slots = STAMP_SLOTS.slice(0, count)

    // Shuffle badge→slot mapping per seed so two users with identical
    // badge sets but different usernames get visually distinct layouts.
    const shuffledBadges = rng.shuffle(picked)

    return slots.map((slot, i): StampPlacement => {
        const badge = shuffledBadges[i]
        const meta = getBadgeMeta(badge.code)
        const year = badge.earnedAt ? `'${String(new Date(badge.earnedAt).getFullYear()).slice(-2)}` : undefined
        return {
            badge: {
                code: badge.code,
                caption: meta.caption,
                captionBg: meta.captionBg,
                iconUrl: getBadgeIcon(badge.code),
                year,
            },
            top: slot.top + rng.float(-slot.jitterXY, slot.jitterXY),
            left: slot.left + rng.float(-slot.jitterXY, slot.jitterXY),
            rotation: slot.rotation + rng.float(-slot.jitterRot, slot.jitterRot),
            behind: slot.behind,
            withTape: !!slot.withTape,
            width,
            height,
        }
    })
}

// ─── Decorations (stars + thumbs-up + peanut chars) ─────────────────────
// Pool of candidate positions in safe negative-space zones.
// `kind` selects which SVG. PRNG picks which subset to actually render.

interface DecorationCandidate {
    kind: 'star' | 'thumbsUp' | 'peanutWaving' | 'peanutHands'
    top?: number
    bottom?: number
    left?: number
    right?: number
    size: number
    rotation: number
    /** Whether this position is "safe" when card has stamps behind it.
     *  Currently always true — pool is curated to avoid stamp slots. */
    safe: boolean
}

// Peanut characters get a much bigger native size than stars — the
// SVGs have fine line detail that goes blurry below ~100px native, and
// stars are simple geometric shapes that downscale cleanly even at 50px.
const DECORATION_POOL: readonly DecorationCandidate[] = [
    // Top margin
    { kind: 'star', top: 36, left: 380, size: 72, rotation: 8, safe: true },
    { kind: 'star', top: 52, left: 720, size: 60, rotation: -12, safe: true },
    { kind: 'thumbsUp', top: 56, left: 232, size: 132, rotation: -10, safe: true },
    // Mid-right margin
    { kind: 'star', top: 286, right: 22, size: 64, rotation: 45, safe: true },
    { kind: 'peanutWaving', top: 316, right: 24, size: 140, rotation: 12, safe: true },
    // Bottom margin
    { kind: 'star', bottom: 96, right: 320, size: 56, rotation: -8, safe: true },
    { kind: 'star', bottom: 282, right: 64, size: 52, rotation: 22, safe: true },
    { kind: 'peanutHands', bottom: 124, left: 26, size: 140, rotation: -8, safe: true },
] as const

export interface DecorationPlacement {
    kind: 'star' | 'thumbsUp' | 'peanutWaving' | 'peanutHands'
    top?: number
    bottom?: number
    left?: number
    right?: number
    size: number
    rotation: number
}

/** Pick 4-6 decorations from the pool, ensuring variety (at least 1 star
 *  + 1 character). */
export function placeDecorations(rng: SeededRandom): DecorationPlacement[] {
    const stars = DECORATION_POOL.filter((d) => d.kind === 'star')
    const characters = DECORATION_POOL.filter((d) => d.kind !== 'star')
    // 3-4 stars + 2-3 characters, scattered.
    const numStars = rng.int(3, 4)
    const numChars = rng.int(2, 3)
    const pickedStars = rng.shuffle(stars).slice(0, numStars)
    const pickedChars = rng.shuffle(characters).slice(0, numChars)
    return [...pickedStars, ...pickedChars].map((d) => ({
        kind: d.kind,
        top: d.top,
        bottom: d.bottom,
        left: d.left,
        right: d.right,
        size: d.size + rng.float(-4, 4),
        rotation: d.rotation + rng.float(-6, 6),
    }))
}

// ─── Stats inline block ─────────────────────────────────────────────────
// Returns ONLY the columns that have data. Hides $0 / 0-count / null fields.

export interface StatColumn {
    label: string
    value: string
}

export function buildStatColumns(stats: ShareAssetStats | undefined): StatColumn[] {
    const cols: StatColumn[] = []
    if (stats?.joinedAt) {
        const d = new Date(stats.joinedAt)
        const month = d.toLocaleString('en-US', { month: 'short' }).toUpperCase()
        const yr = `'${String(d.getFullYear()).slice(-2)}`
        cols.push({ label: 'SINCE', value: `${month} ${yr}` })
    }
    if (typeof stats?.totalMovedUsd === 'number' && stats.totalMovedUsd > 0) {
        cols.push({ label: 'MOVED', value: formatUsd(stats.totalMovedUsd) })
    }
    if (typeof stats?.totalTxns === 'number' && stats.totalTxns > 0) {
        cols.push({ label: 'TXNS', value: stats.totalTxns.toLocaleString('en-US') })
    }
    if (typeof stats?.invitedCount === 'number' && stats.invitedCount > 0) {
        cols.push({ label: 'INVITED', value: stats.invitedCount.toString() })
    }
    return cols
}

// Compact-dollar format dedicated to the share asset's stats block.
// Different threshold than `formatExtendedNumber` (which compacts only past
// 6 digits) — we want $12.5K to read on a stamp at thumbnail size.
function formatUsd(n: number): string {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
    if (n >= 10_000) return `$${(n / 1_000).toFixed(1)}K`
    return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

/** Sizing function for the username pill — auto-shrinks for long names.
 *  Tuned for the 1200×900 canvas where the pill is the bottom-right
 *  anchor; floor is 56 so even max-length usernames stay readable at
 *  Twitter mobile thumbnail (~3.4× downscale → ≥16px on-screen). */
export function usernameFontSize(username: string): number {
    const len = username.length
    if (len <= 5) return 92
    if (len <= 8) return 80
    if (len <= 11) return 68
    if (len <= 14) return 60
    return 56
}
