/**
 * Layout-engine edge-case tests.
 *
 * The visual render of <ShareAssetD3 /> is hard to unit-test (animations,
 * canvas pixelation, DOM positioning). The LAYOUT FUNCTIONS are pure and
 * deterministic — those we can pin down here. Anything that breaks the
 * "same input ⇒ same output" contract for production OG rendering would
 * regress here.
 */

// jest-transform-stub flattens svg imports to a bare string; getBadgeIcon unwraps
// PEANUTMAN_LOGO.src, so mirror the real StaticImageData shape for the fallback path.
jest.mock('@/assets/mascot', () => ({
    ...jest.requireActual('@/assets/mascot'),
    PEANUTMAN_LOGO: { src: '/peanut-logo-stub.svg' },
}))

import { SeededRandom } from '../seededRandom'
import {
    CANVAS_W,
    CANVAS_H,
    CARD_LEFT,
    CARD_TOP,
    placeStamps,
    placeDecorations,
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

    it('keeps stamps within canvas bounds (no clipping past edges)', () => {
        const badges = Array.from({ length: 6 }, (_, i) => badge(`B${i}`))
        const placed = placeStamps(badges, rng())
        for (const s of placed) {
            // Allow stamps to overlap card edges (collage layout intentionally
            // peeks/overlaps) but every stamp's top-left anchor + its size
            // should land within the canvas with generous tolerance.
            expect(s.top).toBeGreaterThanOrEqual(-20)
            expect(s.left).toBeGreaterThanOrEqual(-20)
            expect(s.top + s.height).toBeLessThanOrEqual(CANVAS_H + 20)
            expect(s.left + s.width).toBeLessThanOrEqual(CANVAS_W + 20)
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

    // Strict non-overlap invariant for the "unique-slot" range (1..6
    // unique slots in the table). For every count 1..6 and across many
    // seeds, no two placed stamps' rotation-aware bboxes may touch.
    //
    // We use the diagonal sqrt(w² + h²) as a worst-case radius from the
    // stamp's center. Two stamps "overlap" if the distance between their
    // centers is less than the sum of their radii. This is conservative
    // (treats the rotated rect as a circumscribing circle) — if it
    // passes, the actual rotated rects definitely don't overlap.
    //
    // For counts > 6 we deliberately stack (Hugo: "just stack them") so
    // the invariant does not apply; the layout still stays within canvas
    // (separate test below).
    it('stamps never overlap for counts 1..6 (any seed)', () => {
        const seeds = ['kkonrad', 'hugo', 'asfsfsf', 'a', 'longusername', '0', 'seed-42', '🥜']
        for (let n = 1; n <= 6; n++) {
            const badges = Array.from({ length: n }, (_, i) => badge(`B${i}`))
            for (const seed of seeds) {
                const placed = placeStamps(badges, new SeededRandom(seed))
                for (let i = 0; i < placed.length; i++) {
                    for (let j = i + 1; j < placed.length; j++) {
                        const a = placed[i]
                        const b = placed[j]
                        const cxA = a.left + a.width / 2
                        const cyA = a.top + a.height / 2
                        const cxB = b.left + b.width / 2
                        const cyB = b.top + b.height / 2
                        const dist = Math.hypot(cxA - cxB, cyA - cyB)
                        const radA = Math.hypot(a.width, a.height) / 2
                        const radB = Math.hypot(b.width, b.height) / 2
                        const required = radA + radB
                        if (dist < required) {
                            throw new Error(
                                `Stamp overlap at count=${n} seed="${seed}": ` +
                                    `slots ${i} (${a.badge.code} @ ${a.left.toFixed(0)},${a.top.toFixed(0)}) ` +
                                    `and ${j} (${b.badge.code} @ ${b.left.toFixed(0)},${b.top.toFixed(0)}) ` +
                                    `— distance ${dist.toFixed(0)} < required ${required.toFixed(0)}`
                            )
                        }
                    }
                }
            }
        }
    })

    // For any count (including 15+, which stacks), every stamp's axis-
    // aligned bbox must fit within the canvas with at most a small
    // overhang tolerance — half-outside-the-canvas was the regression
    // Hugo flagged in QA.
    it('every stamp stays within canvas at any count', () => {
        const seeds = ['kkonrad', 'hugo', 'asfsfsf', 'longusername', 'seed-42']
        const overhang = 20 // peeking off-edge is part of the design, but only this much
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
})

describe('placeDecorations', () => {
    it('returns at least one star and one character', () => {
        const placed = placeDecorations(new SeededRandom('kkonrad'))
        const kinds = new Set(placed.map((d) => d.kind))
        expect(kinds.has('star')).toBe(true)
        expect(placed.some((d) => d.kind !== 'star')).toBe(true)
    })

    it('is deterministic per seed', () => {
        const a = placeDecorations(new SeededRandom('kkonrad'))
        const b = placeDecorations(new SeededRandom('kkonrad'))
        expect(a).toEqual(b)
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
