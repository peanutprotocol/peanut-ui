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
// Twitter-optimised: the card is the hero, sized to ~63% of canvas width so
// it stays legible after a timeline's ~3-4× thumbnail downscale. Stamps +
// decorations frame it at the edges rather than competing for centre space.
export const CARD_W = 760
export const CARD_H = Math.round(CARD_W / 1.586) // ≈ 479
export const CARD_LEFT = Math.round((CANVAS_W - CARD_W) / 2) // 220 — centred
export const CARD_TOP = Math.round((CANVAS_H - CARD_H) / 2) // 210 — centred
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
    badge: { code: string; iconUrl: string; year?: string }
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
// Low counts (1–3, the common case) get a Twitter-legibility bump; counts
// 4–10 stay near original since the collage crowds and the non-overlap
// invariant (circumscribing-circle metric + jitter) leaves little headroom.
const STAMP_SIZE_BY_COUNT: ReadonlyArray<readonly [number, number]> = [
    [248, 290], // 1 — only slot 1 (hero, top=140) used; canvas-safe.
    [182, 188], // 2 — slot 2 (top=720) activates here; height capped at 188.
    [176, 186], // 3
    [168, 182], // 4
    [156, 170], // 5
    [144, 158], // 6
    [136, 150], // 7
    [128, 142], // 8
    [120, 134], // 9
    [112, 126], // 10
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
        // `'25`-style year denomination. (An earlier pass switched this to the
        // full 4-digit year chasing Konrad's "the ''' look buggy" note — that
        // was actually about sparkle.svg's slash-strokes, not the year. Hugo
        // 2026-06-11: the apostrophe year looked fine; bring it back.)
        const year = badge.earnedAt ? `'${String(new Date(badge.earnedAt).getFullYear()).slice(-2)}` : undefined
        return {
            badge: {
                code: badge.code,
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
    kind: 'star' | 'starAlt' | 'thumbsUp' | 'thumbsUpV2' | 'peace' | 'eyes' | 'cloud' | 'peanutChar'
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

// Decoration pool. No peanut characters — both peanut-raising-hands.svg
// and peanutman-waving.svg crop the lower body at the SVG source (it's
// the art style, not a bug we can fix). No sparkle.svg either — it's
// three loose slash-strokes that read as stray tick marks / apostrophes
// on the asset (Konrad's "the ''' look a bit buggy"). The pool sticks to
// stars, hands, eyes, and clouds so every decoration reads as a clearly
// formed shape.
//
// Layout-zone map on the 1200×900 canvas:
//   - EARNED stamp:          x[920..1200], y[20..200]    (top-right)
//   - EDITION + tier block:  x[20..360],   y[20..460]    (left band)
//   - @username pill:        x[400..1144], y[770..900]   (bottom-right)
//   - Card bbox:             x[264..884],  y[254..645]   (centre)
//   - Stamp slots:           see STAMP_SLOTS above
// All slots below sit OUTSIDE the chrome zones AND outside stamp slots.
const DECORATION_POOL: readonly DecorationCandidate[] = [
    // ── Top strip (y=16..160) — above the card, between EDITION left and
    //    EARNED right. Two natural columns left/right of the centre stamp.
    { kind: 'cloud', top: 16, left: 880, size: 64, rotation: -4, safe: true },
    { kind: 'star', top: 36, left: 380, size: 72, rotation: 8, safe: true },
    { kind: 'peace', top: 52, left: 720, size: 56, rotation: -12, safe: true },
    { kind: 'thumbsUp', top: 56, left: 232, size: 92, rotation: -10, safe: true },
    { kind: 'thumbsUpV2', top: 80, left: 700, size: 76, rotation: 12, safe: true },
    { kind: 'eyes', top: 28, left: 580, size: 48, rotation: 6, safe: true },
    { kind: 'star', top: 130, left: 980, size: 40, rotation: 18, safe: true },
    { kind: 'starAlt', top: 110, left: 320, size: 52, rotation: -20, safe: true },

    // ── Top-LEFT quadrant (Hugo flagged this as empty) — fits between
    //    the EDITION header (y<120) and the tier block (y>158, x<360).
    //    Tight space; small accents only.
    { kind: 'star', top: 14, left: 56, size: 32, rotation: 22, safe: true },
    { kind: 'starAlt', top: 8, left: 460, size: 36, rotation: -16, safe: true },
    { kind: 'eyes', top: 130, left: 180, size: 36, rotation: 14, safe: true },

    // ── Mid-right gap between stamp slot 3 (y≤396) and slot 5 (y≥470).
    { kind: 'star', top: 410, right: 30, size: 44, rotation: 45, safe: true },
    { kind: 'peace', top: 420, right: 140, size: 42, rotation: -10, safe: true },

    // ── Mid-left / mid-right margins outside the card.
    { kind: 'cloud', top: 380, left: 26, size: 48, rotation: 10, safe: true },
    { kind: 'eyes', top: 540, right: 220, size: 38, rotation: 22, safe: true },
    { kind: 'starAlt', top: 480, right: 200, size: 44, rotation: -8, safe: true },

    // ── Bottom-CENTRE (Hugo flagged this as empty) — between card-bottom
    //    (y=645) and the username pill top (y≥770). The pill ends at
    //    x≈400 worst case, so anything in x[120..380] is safely in the
    //    gutter to the LEFT of the pill.
    { kind: 'star', top: 660, left: 200, size: 44, rotation: -14, safe: true },
    { kind: 'starAlt', top: 700, left: 320, size: 48, rotation: 18, safe: true },
    { kind: 'eyes', top: 670, left: 60, size: 40, rotation: -6, safe: true },
    { kind: 'thumbsUpV2', top: 690, left: 130, size: 64, rotation: 8, safe: true },

    // ── Lower-right (small sprinkles between EARNED-zone clear point and
    //    the pill's top edge at y≈770).
    { kind: 'peace', bottom: 220, right: 280, size: 52, rotation: -8, safe: true },
    { kind: 'star', bottom: 60, right: 360, size: 34, rotation: -12, safe: true },
    { kind: 'cloud', bottom: 80, right: 60, size: 56, rotation: 8, safe: true },

    // ── Peanut character — peeks up from BEHIND the card. The peanut
    //    art style is legless (body tapers to a rounded point), so we
    //    place him with his bottom inside the card's bbox (y≥254) and
    //    only the head/arms visible above the card edge. Decorations
    //    render at z-index 1; the card at z-index 3, with overflow:
    //    hidden — so the body inside the card region is naturally
    //    clipped without any extra masking. Two candidate positions
    //    flanking the centre HERO stamp slot (top:140, left:504).
    { kind: 'peanutChar', top: 120, left: 320, size: 180, rotation: -6, safe: true },
    { kind: 'peanutChar', top: 130, left: 760, size: 170, rotation: 8, safe: true },
] as const

export interface DecorationPlacement {
    kind: 'star' | 'starAlt' | 'thumbsUp' | 'thumbsUpV2' | 'peace' | 'eyes' | 'cloud' | 'peanutChar'
    top?: number
    bottom?: number
    left?: number
    right?: number
    size: number
    rotation: number
}

/** Axis-aligned bounding-box of a placed decoration in canvas coords.
 *  Used by the non-overlap check below — treats every decoration as a
 *  size × size square (conservative; tall assets won't be over-tight). */
function decorationBbox(d: { top?: number; bottom?: number; left?: number; right?: number; size: number }): {
    x0: number
    y0: number
    x1: number
    y1: number
} {
    const left = d.left ?? CANVAS_W - (d.right ?? 0) - d.size
    const top = d.top ?? CANVAS_H - (d.bottom ?? 0) - d.size
    return { x0: left, y0: top, x1: left + d.size, y1: top + d.size }
}

/** AABB intersection with a small padding so decorations aren't just-not-touching. */
function bboxesOverlap(
    a: { x0: number; y0: number; x1: number; y1: number },
    b: { x0: number; y0: number; x1: number; y1: number },
    pad = 8
): boolean {
    return !(a.x1 + pad < b.x0 || a.x0 - pad > b.x1 || a.y1 + pad < b.y0 || a.y0 - pad > b.y1)
}

/** Greedy non-overlap placement. Walks the shuffled pool and accepts a
 *  candidate only if its bbox doesn't intersect any already-placed
 *  decoration. Target count 12-15; if the pool can't satisfy that
 *  (collisions), returns whatever fit — never compromises the no-overlap
 *  invariant. */
export function placeDecorations(rng: SeededRandom): DecorationPlacement[] {
    const target = rng.int(12, 15)
    const shuffled = rng.shuffle([...DECORATION_POOL])
    const accepted: DecorationPlacement[] = []
    const acceptedBboxes: ReturnType<typeof decorationBbox>[] = []

    for (const d of shuffled) {
        if (accepted.length >= target) break
        const sizeJitter = rng.float(-4, 4)
        const rotJitter = rng.float(-6, 6)
        const placement: DecorationPlacement = {
            kind: d.kind,
            top: d.top,
            bottom: d.bottom,
            left: d.left,
            right: d.right,
            size: d.size + sizeJitter,
            rotation: d.rotation + rotJitter,
        }
        const bbox = decorationBbox(placement)
        const collides = acceptedBboxes.some((other) => bboxesOverlap(bbox, other))
        if (collides) continue
        accepted.push(placement)
        acceptedBboxes.push(bbox)
    }
    return accepted
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
