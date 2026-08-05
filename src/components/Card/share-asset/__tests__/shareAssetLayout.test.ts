/**
 * Layout-engine edge-case tests.
 *
 * The visual render of <ShareAssetD3 /> is hard to unit-test (animations,
 * canvas pixelation, DOM positioning). The LAYOUT FUNCTIONS are pure and
 * deterministic — those we can pin down here. Anything that breaks the
 * "same input ⇒ same output" contract for production OG rendering would
 * regress here.
 */

import { SeededRandom } from '../seededRandom'
import {
    CANVAS_W,
    CANVAS_H,
    CARD_LEFT,
    CARD_TOP,
    PILL_RIGHT,
    PILL_BOTTOM,
    placeStamps,
    pillKeepoutBox,
    buildStatColumns,
    usernameFontSize,
} from '../shareAssetLayout'

const badge = (code: string, year = 2025) => ({
    code,
    earnedAt: new Date(year, 5, 1).toISOString(),
})

describe('SeededRandom', () => {
    it('produces the same sequence for the same string seed', () => {
        const a = new SeededRandom('kkonrad')
        const b = new SeededRandom('kkonrad')
        for (let i = 0; i < 20; i++) expect(a.next()).toBeCloseTo(b.next(), 10)
    })

    it('produces a different sequence for a different seed', () => {
        const a = new SeededRandom('kkonrad')
        const b = new SeededRandom('hugo')
        let differed = false
        for (let i = 0; i < 20; i++) if (a.next() !== b.next()) differed = true
        expect(differed).toBe(true)
    })

    it('survives the zero-seed edge case (mulberry32 hates 0)', () => {
        const r = new SeededRandom(0)
        expect(() => r.next()).not.toThrow()
        expect(r.next()).toBeGreaterThan(0)
    })

    it('shuffle is a permutation', () => {
        const r = new SeededRandom('seed')
        const arr = [1, 2, 3, 4, 5, 6, 7, 8]
        const shuffled = r.shuffle(arr)
        expect(shuffled.length).toBe(arr.length)
        expect([...shuffled].sort()).toEqual([...arr].sort())
    })
})

describe('placeStamps', () => {
    const rng = () => new SeededRandom('kkonrad')

    it('returns 0 stamps for 0 badges', () => {
        expect(placeStamps([], rng())).toEqual([])
    })

    it('returns N stamps for N badges (N ≤ 6)', () => {
        for (let n = 1; n <= 6; n++) {
            const badges = Array.from({ length: n }, (_, i) => badge(`B${i}`))
            expect(placeStamps(badges, rng()).length).toBe(n)
        }
    })

    it('renders every badge for 6+ badges (no cap, most-recent first)', () => {
        const badges = Array.from({ length: 9 }, (_, i) => badge(`B${i}`, 2025 - i))
        const placed = placeStamps(badges, rng())
        expect(placed.length).toBe(9)
        // Every code shows up — no silent drops at the cap boundary.
        const codes = new Set(placed.map((s) => s.badge.code))
        for (let i = 0; i < 9; i++) expect(codes.has(`B${i}`)).toBe(true)
    })

    it('stamp size scales inversely with badge count', () => {
        const single = placeStamps([badge('A')], rng())
        const six = placeStamps(
            Array.from({ length: 6 }, (_, i) => badge(`B${i}`)),
            rng()
        )
        expect(single[0].width).toBeGreaterThan(six[0].width)
    })

    it('keeps stickers within canvas bounds (bounded off-edge peek)', () => {
        const badges = Array.from({ length: 6 }, (_, i) => badge(`B${i}`))
        const placed = placeStamps(badges, rng())
        for (const s of placed) {
            // Stickers intentionally overlap the card and may peek off-edge,
            // but only within a bounded tolerance — half-off-canvas was the
            // regression Hugo flagged in QA.
            expect(s.top).toBeGreaterThanOrEqual(-40)
            expect(s.left).toBeGreaterThanOrEqual(-40)
            expect(s.top + s.height).toBeLessThanOrEqual(CANVAS_H + 40)
            expect(s.left + s.width).toBeLessThanOrEqual(CANVAS_W + 40)
        }
    })

    it('produces the same layout for the same seed (determinism)', () => {
        const badges = Array.from({ length: 5 }, (_, i) => badge(`B${i}`))
        const a = placeStamps(badges, new SeededRandom('kkonrad'))
        const b = placeStamps(badges, new SeededRandom('kkonrad'))
        expect(a).toEqual(b)
    })

    it('produces different layouts for different seeds', () => {
        const badges = Array.from({ length: 5 }, (_, i) => badge(`B${i}`))
        const a = placeStamps(badges, new SeededRandom('kkonrad'))
        const b = placeStamps(badges, new SeededRandom('hugo'))
        // At least one stamp should be in a different position OR have a
        // different badge assignment.
        const aSig = a.map((s) => `${s.badge.code}@${s.top.toFixed(0)},${s.left.toFixed(0)}`).join('|')
        const bSig = b.map((s) => `${s.badge.code}@${s.top.toFixed(0)},${s.left.toFixed(0)}`).join('|')
        expect(aSig).not.toEqual(bSig)
    })

    it('handles unknown badge codes by falling back to the peanut logo icon', () => {
        const placed = placeStamps([badge('NOT_A_REAL_BADGE_CODE')], rng())
        expect(placed.length).toBe(1)
        // No caption/captionBg anymore — stamps don't render text. Just
        // verify the placement carries an icon URL fallback.
        expect(placed[0].badge.iconUrl).toBeTruthy()
    })

    // Light overlap is fine for the collage, but the force-directed placer must
    // never let two stickers pile up. Across the realistic range (2..12) and a
    // BROAD seed sweep, every pair of centres must stay at least this fraction
    // of the sticker size apart — i.e. no "heavy" overlap. The sweep is wide on
    // purpose: a bottom-right "corner trap" (edge + pill keep-out deadlocking
    // pairwise separation) only surfaced on specific numeric seeds that a small
    // hand-picked seed list missed — the final separation pass fixes it, and
    // this sweep guards the regression.
    it('never places two stickers in heavy overlap (broad seed sweep)', () => {
        const seeds = [
            'kkonrad',
            'hugo',
            'asfsfsf',
            'a',
            'longusername',
            '0',
            'seed-42',
            'zzz',
            'mara',
            '🥜',
            // numeric sweep — exercises the corner-trap regime the named seeds miss
            ...Array.from({ length: 150 }, (_, i) => `seed${i}`),
        ]
        const MIN_CENTER_GAP = 0.4 // × size; below this is a heavy pile-up
        for (let n = 2; n <= 12; n++) {
            const badges = Array.from({ length: n }, (_, i) => badge(`B${i}`))
            for (const seed of seeds) {
                const placed = placeStamps(badges, new SeededRandom(seed))
                const size = placed[0].width
                for (let i = 0; i < placed.length; i++) {
                    for (let j = i + 1; j < placed.length; j++) {
                        const a = placed[i]
                        const b = placed[j]
                        const dist = Math.hypot(
                            a.left + a.width / 2 - (b.left + b.width / 2),
                            a.top + a.height / 2 - (b.top + b.height / 2)
                        )
                        if (dist < MIN_CENTER_GAP * size) {
                            throw new Error(
                                `Heavy overlap at count=${n} seed="${seed}": centres ${dist.toFixed(0)}px apart ` +
                                    `(< ${(MIN_CENTER_GAP * size).toFixed(0)} = ${MIN_CENTER_GAP}×${size})`
                            )
                        }
                    }
                }
            }
        }
    })

    // For any count (including 15+, which stacks), every sticker's axis-
    // aligned bbox must fit within the canvas with at most a small
    // overhang tolerance — half-outside-the-canvas was the regression
    // Hugo flagged in QA.
    it('every sticker stays within canvas at any count', () => {
        const seeds = ['kkonrad', 'hugo', 'asfsfsf', 'longusername', 'seed-42']
        const overhang = 40 // peeking off-edge is part of the design, but only this much
        for (let n = 1; n <= 15; n++) {
            const badges = Array.from({ length: n }, (_, i) => badge(`B${i}`))
            for (const seed of seeds) {
                const placed = placeStamps(badges, new SeededRandom(seed))
                for (const s of placed) {
                    expect(s.left).toBeGreaterThanOrEqual(-overhang)
                    expect(s.top).toBeGreaterThanOrEqual(-overhang)
                    expect(s.left + s.width).toBeLessThanOrEqual(CANVAS_W + overhang)
                    expect(s.top + s.height).toBeLessThanOrEqual(CANVAS_H + overhang)
                }
            }
        }
    })

    it('renders every badge (no silent cap)', () => {
        const badges = Array.from({ length: 13 }, (_, i) => badge(`B${i}`))
        const placed = placeStamps(badges, new SeededRandom('kkonrad'))
        expect(placed.length).toBe(13)
    })

    // The @username pill is the whole point of the shareable asset, so the
    // repulsion must keep stickers off it — including through the final
    // separation pass, which used to DROP the pill keep-out and let a sticker
    // get shoved onto the handle on the last cleanup pass (covering ~65% of the
    // pill in the worst case). No sticker may heavily overlap the pill's
    // rendered footprint. (The pill also renders above the stickers as a
    // hard guarantee, but that's a render concern; here we pin the layout.)
    it('keeps stickers off the username pill (final pass respects the keep-out)', () => {
        const seeds = ['kkonrad', 'hugo', 'testo', 'me', 'a', 'longusername', 'satoshi', '🥜']
        // Representative rendered pill footprints (short handle → long handle).
        const pills = [
            { w: 300, h: 120 },
            { w: 460, h: 110 },
            { w: 620, h: 100 },
        ]
        const MAX_PILL_COVER = 0.4 // fraction of the pill rect a sticker may overlap
        for (const { w, h } of pills) {
            const box = pillKeepoutBox(w, h)
            // Rendered pill rect: bottom-right anchored (box top-left → canvas corner inset).
            const rect = { x0: box.x0, y0: box.y0, x1: CANVAS_W - PILL_RIGHT, y1: CANVAS_H - PILL_BOTTOM }
            const rectArea = (rect.x1 - rect.x0) * (rect.y1 - rect.y0)
            for (let n = 1; n <= 8; n++) {
                const badges = Array.from({ length: n }, (_, i) => badge(`B${i}`))
                for (const seed of seeds) {
                    const placed = placeStamps(badges, new SeededRandom(seed), [], box)
                    for (const s of placed) {
                        const ix = Math.max(0, Math.min(s.left + s.width, rect.x1) - Math.max(s.left, rect.x0))
                        const iy = Math.max(0, Math.min(s.top + s.height, rect.y1) - Math.max(s.top, rect.y0))
                        const cover = (ix * iy) / rectArea
                        if (cover > MAX_PILL_COVER) {
                            throw new Error(
                                `Sticker covers ${(cover * 100).toFixed(0)}% of the username pill ` +
                                    `at count=${n} seed="${seed}" pill=${w}×${h} (max ${MAX_PILL_COVER * 100}%)`
                            )
                        }
                    }
                }
            }
        }
    })
})

describe('buildStatColumns', () => {
    it('returns empty array when all stats are missing', () => {
        expect(buildStatColumns(undefined)).toEqual([])
        expect(buildStatColumns({})).toEqual([])
    })

    it('hides zero/null fields individually', () => {
        const cols = buildStatColumns({
            joinedAt: '2025-10-12',
            totalMovedUsd: 0,
            totalTxns: 142,
            invitedCount: null,
        })
        const labels = cols.map((c) => c.label)
        expect(labels).toContain('SINCE')
        expect(labels).toContain('TXNS')
        expect(labels).not.toContain('MOVED')
        expect(labels).not.toContain('INVITED')
    })

    it('formats large USD amounts compactly', () => {
        expect(buildStatColumns({ totalMovedUsd: 4287 })[0].value).toBe('$4,287')
        expect(buildStatColumns({ totalMovedUsd: 12_500 })[0].value).toBe('$12.5K')
        expect(buildStatColumns({ totalMovedUsd: 1_500_000 })[0].value).toBe('$1.5M')
    })

    it('formats SINCE as month + 2-digit year', () => {
        const cols = buildStatColumns({ joinedAt: '2025-10-12' })
        expect(cols[0].value).toMatch(/^[A-Z]{3} '\d{2}$/)
    })
})

describe('usernameFontSize', () => {
    it('shrinks with length', () => {
        expect(usernameFontSize('me')).toBe(92)
        expect(usernameFontSize('konrad')).toBe(80)
        expect(usernameFontSize('kkonrad')).toBe(80)
        expect(usernameFontSize('aaahugo123')).toBe(68)
        expect(usernameFontSize('twelvecharsxx')).toBeLessThanOrEqual(60)
        expect(usernameFontSize('reallylongusernameseriouslytwentyplus')).toBe(56)
    })
})

describe('canvas constants', () => {
    it('uses 4:3 postage-stamp proportions', () => {
        expect(CANVAS_W).toBe(1200)
        expect(CANVAS_H).toBe(900)
    })

    it('card anchor sits inside the canvas', () => {
        expect(CARD_LEFT).toBeGreaterThanOrEqual(0)
        expect(CARD_TOP).toBeGreaterThanOrEqual(0)
    })
})
