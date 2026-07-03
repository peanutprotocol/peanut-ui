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

// ─── Sticker placement (force-directed) ─────────────────────────────────
// Stickers fill the blue field AROUND the card using a small position-based
// relaxation (a constraint solver, not a fixed ring). Three forces settle
// them into the 2D background instead of crowding a single ellipse:
//   • a strong keep-clear ellipse over the card centre repels stickers off
//     the card's middle, so the pixel logo stays readable;
//   • every sticker repels every other, so they spread out and barely
//     overlap, however many there are;
//   • a soft inward margin pulls them off the extreme canvas edge.
// They still render on top of the card (z-index above it) and may cover its
// outer edges; only its centre and the bottom-right @username pill are kept
// clear.
const FIELD_CX = CANVAS_W / 2 // 600
const FIELD_CY = CANVAS_H / 2 // 450

// Seed ellipse — only used to scatter the initial positions around the card
// before relaxation. The actual "don't cover this" repulsion lives in
// CARD_KEEPOUTS (the centred hand keep-out doubles as the card-centre guard).
const KEEP_A = 300
const KEEP_B = 205

// Specific card graphics that must never be covered. Unlike the soft centre
// ellipse above, each of these is inflated by the sticker's half-size in the
// solver, so no sticker overlaps the mark at all (not just its centre).
// Positions are canvas coords: the card renders at (220,210) sized 760×479,
// rotated −8° about its centre (600,450) — these are the peanut logo
// (card-local ~54,50) and the pixel hand (card-local ~460,200) mapped through
// that transform.
const CARD_KEEPOUTS: readonly { cx: number; cy: number; rx: number; ry: number }[] = [
    { cx: 251, cy: 307, rx: 40, ry: 40 }, // peanut logo (top-left of the card)
    { cx: 660, cy: 405, rx: 142, ry: 100 }, // pixelated hand (centre, leaning up-right)
]

// Soft inward margin from the canvas edge — pulls stickers off the extreme
// edge into the background; the hard clamp keeps the bbox within OVERHANG.
const EDGE_MARGIN = 32
const STICKER_OVERHANG = 24

// Repulsion keep-out for the @username pill (bottom-right corner). Its rect
// extends to the bottom-right canvas corner; PILL_PAD adds a margin so the
// repulsion leaves a gap, not just a touch. Any sticker pushed inside is
// shoved back out each relaxation pass — the pill repels like everything else.
// The component passes a box sized to the *rendered* pill (see pillKeepoutBox);
// this default is the fallback for callers that don't measure it.
const DEFAULT_PILL_KEEPOUT = { x0: 690, y0: 712 } as const
const PILL_PAD = 26

// The pill renders bottom-right at `right: PILL_RIGHT, bottom: PILL_BOTTOM`.
// Exported so the component keeps the keep-out box in lockstep with the render.
export const PILL_RIGHT = 56
export const PILL_BOTTOM = 48

/** Top-left corner of the pill keep-out for a pill of the given rendered size,
 *  pinned to the bottom-right canvas corner. The component measures the pill's
 *  footprint (it varies with the handle + typography) so badges are kept off
 *  the *whole* pill, not just its right edge. */
export function pillKeepoutBox(pillW: number, pillH: number): { x0: number; y0: number } {
    return {
        x0: CANVAS_W - PILL_RIGHT - pillW,
        y0: CANVAS_H - PILL_BOTTOM - pillH,
    }
}

// Relaxation iterations + how close two sticker centres may sit (× combined
// radii). 1.0 = just touching; below 1.0 allows a bit of overlap while the
// solver still actively repels them apart each pass. SEPARATION_PASSES is a
// final separation-only cleanup (see below) that breaks corner deadlocks.
const RELAX_ITERS = 120
const SEPARATION_PASSES = 28
const STICKER_GAP = 0.82

export interface StampPlacement {
    badge: { code: string; iconUrl: string }
    top: number
    left: number
    rotation: number
    /** Size: shrinks as badge count grows (so 6 badges aren't huge).
     *  Stickers are square — width === height. */
    width: number
    height: number
}

// Sticker size shrinks as the badge count grows, but stays large enough that
// the repulsion packs them across the whole field (not a thin scatter). Past
// the table it eases down a 2700/count curve with a legibility floor.
// Stickers are square (raw badge art, no frame).
const STICKER_SIZE_BY_COUNT: readonly number[] = [
    520, // 1 — single hero sticker slapped on the card
    460, // 2
    415, // 3
    385, // 4
    360, // 5
    340, // 6
    322, // 7
    306, // 8
    292, // 9
    280, // 10
]

function stickerSize(count: number): number {
    if (count <= STICKER_SIZE_BY_COUNT.length) return STICKER_SIZE_BY_COUNT[count - 1]
    return Math.max(180, Math.round(2700 / count))
}

/** Does a size×size sticker centred at (cx,cy) intersect the pill keep-out
 *  (which extends to the bottom-right canvas corner)? */
function hitsPill(cx: number, cy: number, half: number, pill: { x0: number; y0: number }): boolean {
    return cx + half > pill.x0 - PILL_PAD && cy + half > pill.y0 - PILL_PAD
}

/** An extra keep-out region (e.g. the hero message sticker at the top) that
 *  badge stickers must not cover. Canvas-coord ellipse. */
export interface KeepoutEllipse {
    cx: number
    cy: number
    rx: number
    ry: number
}

export function placeStamps(
    badges: ShareAssetBadge[],
    rng: SeededRandom,
    extraKeepouts: readonly KeepoutEllipse[] = [],
    pill: { x0: number; y0: number } = DEFAULT_PILL_KEEPOUT
): StampPlacement[] {
    const sorted = [...badges].sort((a, b) => {
        const aT = a.earnedAt ? new Date(a.earnedAt).getTime() : 0
        const bT = b.earnedAt ? new Date(b.earnedAt).getTime() : 0
        return bT - aT
    })
    const count = sorted.length
    if (count === 0) return []

    const size = stickerSize(count)
    const half = size / 2
    const minC = half - STICKER_OVERHANG
    const maxCx = CANVAS_W - half + STICKER_OVERHANG
    const maxCy = CANVAS_H - half + STICKER_OVERHANG
    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
    const keepouts = [...CARD_KEEPOUTS, ...extraKeepouts]

    // ── Seed positions: spread around the card by angle (so even a few
    //    stickers surround it) with a varied radius (so the relaxation has 2D
    //    room to fill, not just a ring). The first sticker starts up top.
    const pos = sorted.map((_, i) => {
        const theta = -Math.PI / 2 + ((i === 0 ? 0 : i) / count) * Math.PI * 2 + rng.float(-0.4, 0.4)
        const rad = rng.float(1.05, 1.95)
        return {
            x: clamp(FIELD_CX + Math.cos(theta) * KEEP_A * rad, minC, maxCx),
            y: clamp(FIELD_CY + Math.sin(theta) * KEEP_B * rad, minC, maxCy),
        }
    })

    // ── Relax: position-based constraints, Gauss–Seidel. Each pass separates
    //    overlapping stickers, shoves any inside the keep-clear ellipse back
    //    out, nudges them off the edges and out of the pill, then clamps to
    //    the canvas. Converges to an even spread filling the field.
    const minDist = size * STICKER_GAP
    for (let step = 0; step < RELAX_ITERS; step++) {
        // sticker ↔ sticker separation
        for (let i = 0; i < count; i++) {
            for (let j = i + 1; j < count; j++) {
                let dx = pos[j].x - pos[i].x
                let dy = pos[j].y - pos[i].y
                let dist = Math.hypot(dx, dy)
                if (dist === 0) {
                    dx = rng.float(-1, 1)
                    dy = rng.float(-1, 1)
                    dist = Math.hypot(dx, dy) || 1
                }
                if (dist < minDist) {
                    const corr = (minDist - dist) / 2
                    const ux = dx / dist
                    const uy = dy / dist
                    pos[i].x -= ux * corr
                    pos[i].y -= uy * corr
                    pos[j].x += ux * corr
                    pos[j].y += uy * corr
                }
            }
        }
        // unary constraints
        for (let i = 0; i < count; i++) {
            const p = pos[i]
            // targeted keep-outs (inflated by the sticker half so the mark is
            // never covered) — peanut logo + pixel hand, plus any caller extras
            // (the hero message sticker at the top).
            for (const ko of keepouts) {
                const rx = ko.rx + half
                const ry = ko.ry + half
                const kex = (p.x - ko.cx) / rx
                const key = (p.y - ko.cy) / ry
                const ke = Math.hypot(kex, key)
                if (ke === 0) {
                    p.x += rx
                } else if (ke < 1) {
                    const s = 1 / ke
                    p.x = ko.cx + (p.x - ko.cx) * s
                    p.y = ko.cy + (p.y - ko.cy) * s
                }
            }
            // soft inward margin off the canvas edges
            const loX = EDGE_MARGIN + half
            const hiX = CANVAS_W - EDGE_MARGIN - half
            const loY = EDGE_MARGIN + half
            const hiY = CANVAS_H - EDGE_MARGIN - half
            if (p.x < loX) p.x += (loX - p.x) * 0.5
            else if (p.x > hiX) p.x -= (p.x - hiX) * 0.5
            if (p.y < loY) p.y += (loY - p.y) * 0.5
            else if (p.y > hiY) p.y -= (p.y - hiY) * 0.5
            // pill keep-out: shove out along the shallower axis
            if (hitsPill(p.x, p.y, half, pill)) {
                const exitLeft = p.x + half - (pill.x0 - PILL_PAD)
                const exitUp = p.y + half - (pill.y0 - PILL_PAD)
                if (exitLeft < exitUp) p.x -= exitLeft
                else p.y -= exitUp
            }
            // hard clamp to canvas (within overhang)
            p.x = clamp(p.x, minC, maxCx)
            p.y = clamp(p.y, minC, maxCy)
        }
    }

    // ── Final separation pass. The soft edge/pill pulls above can deadlock two
    //    stickers against a corner (a Gauss–Seidel local minimum: the edge +
    //    pill shove keeps cramming them back together faster than the pairwise
    //    push can spread them). Run a short cleanup of separation + hard keep-
    //    outs + clamp ONLY — no edge/pill pull — so pairwise spread gets the
    //    last word. Card marks / hero stay clear; a sticker may drift under the
    //    pill (which renders on top), but no two stickers pile up.
    for (let step = 0; step < SEPARATION_PASSES; step++) {
        for (let i = 0; i < count; i++) {
            for (let j = i + 1; j < count; j++) {
                let dx = pos[j].x - pos[i].x
                let dy = pos[j].y - pos[i].y
                let dist = Math.hypot(dx, dy)
                if (dist === 0) {
                    dx = rng.float(-1, 1)
                    dy = rng.float(-1, 1)
                    dist = Math.hypot(dx, dy) || 1
                }
                if (dist < minDist) {
                    const corr = (minDist - dist) / 2
                    const ux = dx / dist
                    const uy = dy / dist
                    pos[i].x -= ux * corr
                    pos[i].y -= uy * corr
                    pos[j].x += ux * corr
                    pos[j].y += uy * corr
                }
            }
        }
        for (let i = 0; i < count; i++) {
            const p = pos[i]
            for (const ko of keepouts) {
                const rx = ko.rx + half
                const ry = ko.ry + half
                const kex = (p.x - ko.cx) / rx
                const key = (p.y - ko.cy) / ry
                const ke = Math.hypot(kex, key)
                if (ke === 0) {
                    p.x += rx
                } else if (ke < 1) {
                    const s = 1 / ke
                    p.x = ko.cx + (p.x - ko.cx) * s
                    p.y = ko.cy + (p.y - ko.cy) * s
                }
            }
            p.x = clamp(p.x, minC, maxCx)
            p.y = clamp(p.y, minC, maxCy)
        }
    }

    return pos.map(
        (p, i): StampPlacement => ({
            badge: { code: sorted[i].code, iconUrl: getBadgeIcon(sorted[i].code) },
            top: p.y - half,
            left: p.x - half,
            rotation: rng.float(-15, 15),
            width: size,
            height: size,
        })
    )
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
