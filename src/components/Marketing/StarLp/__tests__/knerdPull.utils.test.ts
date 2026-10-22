import { FOLLOW_THE_PULL } from '../../../../../public/dev/knerd/preset'
import {
    entranceKeyframes,
    entranceMotion,
    entranceTiming,
    frameStep,
    KNERD_PULL_PRESET,
    magnetTarget,
    magnetTransform,
    springStep,
} from '../knerdPull.utils'

// Expected values are worked out by hand from public/dev/knerd/hero.js with the approved preset.
describe('Follow the pull math', () => {
    it('uses the shared preset object, not a copy', () => {
        expect(KNERD_PULL_PRESET).toBe(FOLLOW_THE_PULL)
        expect(KNERD_PULL_PRESET).toMatchObject({ stiffness: 0.07, damping: 0.8, force: 24, radius: 190, idle: 0 })
    })

    it('rises by drop × font, capped by the room below, and bends 8° only with room above', () => {
        // font 200: drop 0.17 → 34px; plenty of room both ways
        expect(entranceMotion({ index: 0, font: 200, top: 300, bottom: 436, leadBottom: 100, belowTop: 900 })).toEqual({
            travel: 34,
            bend: -5,
        })
        // odd letters lean the other way
        expect(
            entranceMotion({ index: 1, font: 200, top: 300, bottom: 436, leadBottom: 100, belowTop: 900 }).bend
        ).toBe(5)
        // the lead overlaps the Knerd: up clearance 0 → bend capped at 2°
        expect(
            entranceMotion({ index: 0, font: 200, top: 300, bottom: 436, leadBottom: 290, belowTop: 900 }).bend
        ).toBe(-2)
        // 40px to the copy below: 40 − 0.08×200 − 16 = 8px of travel
        expect(
            entranceMotion({ index: 0, font: 200, top: 300, bottom: 436, leadBottom: 100, belowTop: 476 }).travel
        ).toBe(8)
        // never more than 70px
        expect(
            entranceMotion({ index: 0, font: 600, top: 300, bottom: 700, leadBottom: 0, belowTop: 2000 }).travel
        ).toBe(70)
    })

    it('keeps the reviewed keyframes and timing', () => {
        const frames = entranceKeyframes(30, -5)
        expect(frames.map((f) => f.offset)).toEqual([0, 0.5, 0.72, 0.9, 1])
        expect(frames[0].transform).toBe('translateY(30px) rotate(-5deg) scale(0.97,1.04)')
        expect(frames[1].transform).toBe('translateY(-2.85px) rotate(1.5deg) scale(1.045,0.945)')
        expect(frames[4].transform).toBe('translateY(0px) rotate(0deg) scale(1,1)')
        expect(entranceTiming(3)).toEqual({
            duration: 1050,
            delay: 114,
            easing: 'cubic-bezier(.33,0,.2,1)',
            fill: 'both',
        })
    })

    it('counts frames at 60fps, capped at two, the first as one', () => {
        expect(frameStep(1000, 0)).toBe(1)
        expect(frameStep(1016.667, 1000)).toBeCloseTo(1, 5)
        expect(frameStep(1100, 1000)).toBe(2)
    })

    const base = { font: 200, viewportWidth: 1440, left: 500, right: 600, elapsed: 10, index: 0, entering: false }

    it('attracts toward the pointer inside the radius, with force capped by the font', () => {
        // letter 95px right of the pointer: strength (1 − 95/190)^1.4, force 24 (font×0.17 = 34 > 24)
        const { tx, ty } = magnetTarget({ ...base, dx: 95, dy: 0, pulled: true })
        expect(tx).toBeCloseTo(-24 * 0.5 ** 1.4, 6)
        expect(ty).toBeCloseTo(0, 10)
        // outside the radius: no pull; no pointer: rest (idle is 0)
        expect(magnetTarget({ ...base, dx: 300, dy: 0, pulled: true }).tx).toBeCloseTo(0, 10)
        expect(magnetTarget({ ...base, dx: 10, dy: 0, pulled: false })).toEqual({ tx: 0, ty: 0 })
        // a phone narrows the radius to 42% of the width
        expect(
            magnetTarget({ ...base, viewportWidth: 390, left: 100, right: 200, dx: 170, dy: 0, pulled: true }).tx
        ).toBe(0)
    })

    it('never pulls a letter past 12px from the viewport edge', () => {
        const { tx } = magnetTarget({ ...base, left: 20, right: 120, dx: 60, dy: 0, pulled: true })
        expect(tx).toBe(-8)
    })

    it('springs with the preset stiffness and damping, and settles', () => {
        const { next, moving } = springStep({ x: 0, y: 0, vx: 0, vy: 0 }, 10, 0, 1)
        expect(next.vx).toBeCloseTo(10 * 0.07 * 0.8, 10)
        expect(next.x).toBeCloseTo(0.56, 10)
        expect(moving).toBe(true)
        expect(springStep({ x: 0.001, y: 0, vx: 0, vy: 0 }, 0, 0, 1).moving).toBe(false)
        expect(magnetTransform({ x: 10, y: -2, vx: 0, vy: 0 })).toBe('translate(10.000px,-2.000px) rotate(0.750deg)')
    })
})
