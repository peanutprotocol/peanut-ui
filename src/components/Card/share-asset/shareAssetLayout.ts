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

// Slots are positioned to never overlap each other AND never overlap
// fixed chrome on the 1200×900 canvas:
//   - EARNED rubber stamp:        x[920..1200], y[20..200]
//   - EDITION + tier block:       x[20..360],   y[20..460]
//   - @username pill + tagline:   x[400..800],  y[770..900]
//   - Card bbox (axis-aligned):   x[264..884],  y[254..645]
//
// Stamps with `behind:true` may sit ON TOP of the card bbox — they're
// rendered z-index BELOW the card and peek out from behind. Their visible
// portion must still land mostly OUTSIDE the card so the icon reads.
//
// Non-overlap is enforced by shareAssetLayout.test.ts (`stamps never
// overlap`) — DO NOT edit positions without re-running that test.
//
// The catalogue is intentionally larger than 6 (the prior cap). For
// N ≥ 7 we wrap with a per-cycle offset so stacked stamps look like a
// pile rather than perfectly aligned duplicates.
const STAMP_SLOTS: readonly StampSlot[] = [
    // 1. HERO behind, top-center — peeks down from above the card.
    { top: 140, left: 504, jitterXY: 12, rotation: -12, jitterRot: 5, behind: true, withTape: true },
    // 2. Front bottom-left.
    { top: 720, left: 80, jitterXY: 10, rotation: -10, jitterRot: 4, behind: false },
    // 3. Behind upper-right of card (clear of EARNED).
    { top: 220, left: 940, jitterXY: 10, rotation: 14, jitterRot: 5, behind: true },
    // 4. Front mid-left — peeks at card's left edge.
    { top: 440, left: 60, jitterXY: 10, rotation: -16, jitterRot: 4, behind: false },
    // 5. Behind right-of-card, lower half.
    { top: 480, left: 940, jitterXY: 10, rotation: 18, jitterRot: 5, behind: true },
    // 6. Front bottom-right (opposite slot 2 across the pill).
    { top: 720, left: 900, jitterXY: 10, rotation: 8, jitterRot: 4, behind: false },
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

// Inversely scale stamp size with count: 1 stamp gets a hero treatment,
// 10+ stamps shrink to fit. Beyond the table, clamp to the smallest size.
//
// Heights are bounded so bottom slots (top≈720) + max-jitter (10) + height
// stay within the canvas + a 20px overhang tolerance (900 + 20 - 730 = 190).
const STAMP_SIZE_BY_COUNT: ReadonlyArray<readonly [number, number]> = [
    [200, 236], // 1 — only slot 1 (hero, top=140) used; canvas-safe.
    [168, 188], // 2 — slot 2 (top=720) activates here; height capped at 188.
    [162, 180], // 3
    [156, 172], // 4
    [150, 164], // 5
    [140, 156], // 6
    [130, 144], // 7
    [122, 136], // 8
    [116, 130], // 9
    [110, 124], // 10
] as const

export function placeStamps(badges: ShareAssetBadge[], rng: SeededRandom): StampPlacement[] {
    const sorted = [...badges].sort((a, b) => {
        const aT = a.earnedAt ? new Date(a.earnedAt).getTime() : 0
        const bT = b.earnedAt ? new Date(b.earnedAt).getTime() : 0
        return bT - aT
    })
    const count = sorted.length
    if (count === 0) return []

    // Size table is indexed 1..10; clamp anything above to the smallest tier.
    const [width, height] = STAMP_SIZE_BY_COUNT[Math.min(count, STAMP_SIZE_BY_COUNT.length) - 1]

    // Shuffle once so two users with identical badge sets but different
    // seeds get visually distinct layouts.
    const shuffled = rng.shuffle(sorted)

    return shuffled.map((badge, i): StampPlacement => {
        // For i < STAMP_SLOTS.length, use a unique base slot. For overflow
        // (i ≥ slot count), wrap with a per-cycle offset so the extras
        // stack on existing slots as a natural pile (Hugo: "just stack
        // them"). Per-cycle x/y shift + rotation tweak avoid pixel-
        // identical duplicates.
        const slotIdx = i % STAMP_SLOTS.length
        const cycle = Math.floor(i / STAMP_SLOTS.length)
        const base = STAMP_SLOTS[slotIdx]
        const stackOffset = cycle * 22
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
            top: base.top + stackOffset + rng.float(-base.jitterXY, base.jitterXY),
            left: base.left + stackOffset + rng.float(-base.jitterXY, base.jitterXY),
            rotation: base.rotation + cycle * 6 + rng.float(-base.jitterRot, base.jitterRot),
            behind: base.behind,
            withTape: !!base.withTape,
            width,
            height,
        }
    })
}

// ─── Decorations (stars + thumbs-up + peanut chars) ─────────────────────
// Pool of candidate positions in safe negative-space zones.
// `kind` selects which SVG. PRNG picks which subset to actually render.

interface DecorationCandidate {
    kind: 'star' | 'thumbsUp' | 'peanutWaving' | 'eyes' | 'sparkle' | 'cloud'
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

// Decoration pool. Peanut characters (peanutWaving / peanutHands) were
// dropped from the default set — their large native size (140px) made
// them collide with stamp slots at the right and bottom-left, which
// then hid stamps underneath. Stars and thumbsUp are small enough to
// tuck into gaps without competing with stamp positions.
//
// `peanutWaving` + `peanutHands` are still in the type union so we can
// re-introduce them in low-stamp-count layouts later if design wants
// the character vibe back.
const DECORATION_POOL: readonly DecorationCandidate[] = [
    // Top strip — between EDITION block (left) and EARNED stamp (right)
    { kind: 'star', top: 36, left: 380, size: 72, rotation: 8, safe: true },
    { kind: 'sparkle', top: 52, left: 720, size: 56, rotation: -12, safe: true },
    { kind: 'thumbsUp', top: 56, left: 232, size: 92, rotation: -10, safe: true },
    { kind: 'eyes', top: 28, left: 580, size: 48, rotation: 6, safe: true },
    { kind: 'cloud', top: 16, left: 880, size: 64, rotation: -4, safe: true },
    // Mid-right gap between slot 3 (y≤396) and slot 5 (y≥470)
    { kind: 'star', top: 410, right: 30, size: 44, rotation: 45, safe: true },
    { kind: 'sparkle', top: 420, right: 140, size: 42, rotation: -10, safe: true },
    // Mid-left gap between slot 4 (y≤612) and slot 2 (y≥710). Small
    // peanut character + a star. peanutWaving is the full-body asset
    // — peanut-pfp.svg's viewBox crops the lower body so it can't be
    // used as a small floater here (the SVG itself renders truncated).
    { kind: 'peanutWaving', top: 640, left: 220, size: 64, rotation: -6, safe: true },
    { kind: 'star', top: 650, left: 340, size: 40, rotation: 18, safe: true },
    // Bottom-center between card-bottom (y=645) and username pill (y≥770).
    // Pill x range ~[400..800] worst case; keep these in the gutters.
    { kind: 'sparkle', bottom: 220, right: 280, size: 52, rotation: -8, safe: true },
    { kind: 'star', bottom: 110, left: 350, size: 40, rotation: 22, safe: true },
    { kind: 'eyes', bottom: 150, right: 260, size: 48, rotation: -14, safe: true },
] as const

export interface DecorationPlacement {
    kind: 'star' | 'thumbsUp' | 'peanutWaving' | 'eyes' | 'sparkle' | 'cloud'
    top?: number
    bottom?: number
    left?: number
    right?: number
    size: number
    rotation: number
}

/** Pick a handful of decorations from the pool. Pool is curated (stars,
 *  thumbsUp, eyes, sparkle, cloud, mini peanut) and stamp-safe, so we
 *  just shuffle and take 6-8 to fill the canvas margins. */
export function placeDecorations(rng: SeededRandom): DecorationPlacement[] {
    const picked = rng.shuffle([...DECORATION_POOL]).slice(0, rng.int(6, 8))
    return picked.map((d) => ({
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
