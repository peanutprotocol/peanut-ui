// Contract P1 (01 Landing): the X1 walk maths, ported from the mock's screen.js. Checks P1-39…P1-42.
// The module loads per test, so this suite compiles and reports per check while x1-walk.ts is missing.

/** The API T1 expects from `redesign/Landing/x1-walk.ts` (listed in build/tests/T1-HOOKS.md). */
interface X1WalkModule {
    /** Coin x (art px, coin order usd, eur, …) and the body (rig box) top for a world frame. */
    world(device: 'std' | 'sm', wf: number): { coins: number[]; body: number }
    /** The lowest body top over world frames 0–79. */
    minBodyTop(device: 'std' | 'sm'): number
    /** Shown world frame after `elapsed` seconds of walking: 4 + floor(t × 34.5 / 2) × 2. */
    worldFrameAt(elapsed: number): number
    /** One clock step: capped at 0.1 s, a negative step counts as 0. */
    clampStep(deltaSeconds: number): number
    /** Coin tops (YTOP), coin face width, walker comp size. */
    COIN_TOP: number
    COIN_W: number
    RIG_W: number
    RIG_H: number
}

const loadWalk = (): X1WalkModule => require('../x1-walk') as X1WalkModule

const RING = 667.8
const STEP_PER_RIG_FRAME = 2.7825
const expectClose = (actual: number[], expected: number[]) => {
    expect(actual).toHaveLength(expected.length)
    actual.forEach((value, i) => expect(Math.abs(value - expected[i])).toBeLessThanOrEqual(0.01))
}

describe('01 Landing — X1 walk maths', () => {
    it('P1-39 world frame 4 and 6 give the mock’s coin x and body top (std and sm)', () => {
        const { world } = loadWalk()
        const std4 = world('std', 4)
        expectClose(std4.coins, [-100.37, 10.93, 122.23, 233.53, 344.83, 456.13])
        expectClose([std4.body], [229.54])
        const sm4 = world('sm', 4)
        expectClose(sm4.coins, [-58.37, 52.93, 164.23, 275.53, 386.83, -169.67])
        expectClose([sm4.body], [229.54])
        const std6 = world('std', 6)
        expectClose(std6.coins, [-94.8, 16.5, 127.8, 239.1, 350.39, 461.69])
        expectClose([std6.body], [230.24])
    })

    it('the coin row reaches both screen edges at every world frame, down to the smallest art scale (Kush, 2026-11-18)', () => {
        const { world, coinRow, X1_LAYOUT, COIN_W } = require('../x1-walk') as typeof import('../x1-walk')
        const [bandX, bandW] = X1_LAYOUT.std.coinBand
        // a 375 px screen over the 390 art box at scale 0.55, in art px around the box centre (195)
        const view = [195 - 187.5 / 0.55, 195 + 187.5 / 0.55]
        expect(bandX).toBeLessThanOrEqual(view[0])
        expect(bandX + bandW).toBeGreaterThanOrEqual(view[1])
        for (let wf = 0; wf < 80; wf++) {
            const row = coinRow(world('std', wf).coins).sort((a, b) => a.x - b.x)
            let reach = view[0]
            for (const coin of row) if (coin.x <= reach) reach = Math.max(reach, coin.x + COIN_W)
            expect(reach).toBeGreaterThanOrEqual(view[1])
            // neighbours alternate usd and eur, copies included
            row.slice(1).forEach((coin, i) => expect(coin.kind).not.toBe(row[i].kind))
        }
    })

    it('P1-40 the highest body top over wf 0–79 is 226.04; YTOP 392, coin 132.5 wide, comp 183.75 × 175', () => {
        const walk = loadWalk()
        let lowest = Infinity
        for (let wf = 0; wf < 80; wf++) lowest = Math.min(lowest, walk.world('std', wf).body)
        expectClose([lowest], [226.04])
        expectClose([walk.minBodyTop('std')], [226.04])
        expectClose([walk.COIN_TOP], [392])
        expectClose([walk.COIN_W], [132.5])
        expectClose([walk.RIG_W, walk.RIG_H], [183.75, 175])
    })

    it('P1-41 the frame clock: wf = 4 + floor(t × 34.5 / 2) × 2; a step over 0.1 s counts as 0.1, a negative one as 0', () => {
        const { worldFrameAt, clampStep } = loadWalk()
        for (const t of [0, 0.01, 0.05, 0.058, 0.06, 0.5, 1, 1.159, 2.3456, 10]) {
            expect(worldFrameAt(t)).toBe(4 + Math.floor((t * 34.5) / 2) * 2)
        }
        expect(worldFrameAt(0)).toBe(4)
        expect(clampStep(0.5)).toBe(0.1)
        expect(clampStep(0.1)).toBe(0.1)
        expect(clampStep(0.033)).toBeCloseTo(0.033)
        expect(clampStep(-0.2)).toBe(0)
    })

    it('P1-42 coins move 2.7825 px per rig frame (mod the 667.8 ring) and change only when the world frame changes', () => {
        const { world, worldFrameAt } = loadWalk()
        for (let wf = 4; wf < 84; wf += 2) {
            const a = world('std', wf).coins
            const b = world('std', wf + 2).coins
            a.forEach((x, i) => {
                const moved = (((b[i] - x) % RING) + RING) % RING
                expect(Math.abs(moved - 2 * STEP_PER_RIG_FRAME)).toBeLessThanOrEqual(0.01)
            })
        }
        // inside one shown frame (t in [0, 2/34.5)) the clock shows one world frame, so the coins do not move
        const frameTimes = [0, 0.01, 0.03, 0.05]
        const shown = frameTimes.map(worldFrameAt)
        expect(new Set(shown).size).toBe(1)
        const positions = shown.map((wf) => world('std', wf).coins.join(','))
        expect(new Set(positions).size).toBe(1)
        expect(world('std', worldFrameAt(0.06)).coins).not.toEqual(world('std', worldFrameAt(0)).coins)
    })
})
