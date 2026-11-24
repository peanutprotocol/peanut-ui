import { MASCOT_HOLD_FRAMES, MASCOT_SPEED } from '@/components/Global/PeanutMascot/PeanutMascot.consts'
import type { ShellDevice } from '@/components/Setup/redesign/shell/useShellDevice'
import { HR, PROF, SOLES } from './x1-walk.data'

/*
 * The X1 "coin bridge" walk (mock scaffold screens/01-landing/screen.js, a port of X1 walk.js). The walking rig plays
 * as the app plays mascots (30 fps x 1.15, on twos). The coin row moves only when the rig shows a new frame, by the
 * distance the planted shoe travels, so a planted shoe stays on its spot of the coin. The body height follows the coin
 * under the carrying shoe. All sizes are the art box's design px (390 x 520, seam at 520).
 */

export type CoinKind = 'usd' | 'eur'

/** Rig frames per second: the comp's 30 fps at the app's mascot speed. */
export const RIG_RATE = 30 * MASCOT_SPEED
/** Rig units per rig frame: the planted shoe's measured speed (R 15.2, L 16.6). */
const GROUND = 15.9
/** Rig scale: the 1050 x 1000 comp is drawn 183.75 x 175. */
export const RIG_K = 0.175
export const RIG_W = 1050 * RIG_K
export const RIG_H = 1000 * RIG_K
/** Rig frames in one walk cycle. */
export const WALK_FRAMES = 40
/** One coin per walk cycle. */
const PER = 636 * RIG_K
/** Coin face width, 132.5 px. */
export const COIN_W = PER / 0.84
export const SEAM = 520
/** Coin tops: each smile ends 22 px above the seam (392). */
export const COIN_TOP = SEAM - ((SEAM - (498 - 0.8 * COIN_W)) / (0.983 * COIN_W)) * HR.usd * COIN_W
const PHASE = 21
const COINS = 6
/** The ring the coins wrap around: one coin per PER, COINS of them. */
export const COIN_RING = COINS * PER
const SINK = 1.5
/** The hold frame: static captures and reduced motion show world frame 4 (X1's key frame). */
export const KEY_FRAME = 4
/** The longest clock step: a backgrounded tab does not fast-forward the walk. */
const MAX_STEP_S = 0.1

export const COIN_KINDS: readonly CoinKind[] = Array.from({ length: COINS }, (_, i) => (i % 2 ? 'eur' : 'usd'))

/**
 * Per phone size. `left` = walker x; `band` = [x, width] that clips the walker; `coinBand` = [x, width] that clips the
 * coin row; `shift` = how far the ring reaches past the left edge. The std coin band runs past the 390 art box on
 * both sides: the box scales down on shorter phones (0.55 at the least), and the row must still reach both screen
 * edges (Kush, 2026-11-18). [-200, 790] covers a 375 px screen down to scale 0.48.
 */
export const X1_LAYOUT: Record<
    ShellDevice,
    {
        left: number
        band: readonly [number, number]
        coinBand: readonly [number, number]
        shift: number
    }
> = {
    std: { left: 208, band: [0, 390], coinBand: [-200, 790], shift: 0 },
    sm: { left: 250, band: [-100, 600], coinBand: [-100, 600], shift: 70 },
}

const mod = (a: number, n: number) => ((a % n) + n) % n

/** Which shoe may carry the weight in each rig frame: the near shoe R swings low past the planted L in 31-35. */
const canCarry = (foot: 'R' | 'L', f: number) => foot === 'R' || f >= 20 || f <= 8

export type X1World = {
    /** Coin x in art px, in the order of COIN_KINDS. */
    coins: number[]
    /** Body top (the rig box's top) in art px. */
    body: number
}

function surface(coins: number[], x: number): number {
    let y = Infinity
    coins.forEach((cx, i) => {
        const at = Math.floor(((x - cx) / COIN_W) * 200)
        if (at < 0 || at >= 200) return
        const p = PROF[COIN_KINDS[i]][at]
        if (p !== null && p !== undefined) y = Math.min(y, COIN_TOP + p * COIN_W)
    })
    return y
}

function soleTop(coins: number[], left: number, foot: 'R' | 'L', f: number): number {
    const [, a, b] = SOLES[foot][f]
    let top = Infinity
    for (let j = 0; j <= 6; j++) top = Math.min(top, surface(coins, left + RIG_K * (a + ((b - a) * j) / 6)))
    return top
}

/** Coin positions and the body top for world frame `wf`. */
export function world(device: ShellDevice, wf: number): X1World {
    const f = mod(wf, WALK_FRAMES)
    const { left, shift } = X1_LAYOUT[device]
    // the same coin under the same shoe at every phone size
    const offset = wf * GROUND * RIG_K + (left - X1_LAYOUT.std.left) + shift
    const coins = COIN_KINDS.map((_, i) => mod(PHASE + i * PER + offset, COINS * PER) - COIN_W - shift)
    let body = Infinity
    for (const foot of ['R', 'L'] as const)
        if (canCarry(foot, f)) body = Math.min(body, soleTop(coins, left, foot, f) - RIG_K * SOLES[foot][f][0] + SINK)
    return { coins, body }
}

/**
 * The coins to draw: each ring coin and its copies one ring to the left and right, so the row runs on past the ring's
 * ends without a gap. A coin that wraps moves all three copies by one ring, so the row looks the same and nothing
 * remounts. The ring holds an even number of coins, so the copies keep the usd/eur order.
 */
export function coinRow(coins: readonly number[]) {
    return coins.flatMap((x, i) =>
        [-1, 0, 1].map((copy) => ({ x: x + copy * COIN_RING, kind: COIN_KINDS[i], key: `${i}:${copy}` }))
    )
}

/** The highest body top over two walk cycles: the walker box starts above it. */
export function minBodyTop(device: ShellDevice): number {
    let top = Infinity
    for (let wf = 0; wf < 2 * WALK_FRAMES; wf++) top = Math.min(top, world(device, wf).body)
    return top
}

/** One clock step in seconds: capped at 0.1 s, and a negative step (an rAF stamp older than the last) counts as 0. */
export function clampStep(deltaSeconds: number): number {
    return Math.max(0, Math.min(deltaSeconds, MAX_STEP_S))
}

/** The world frame shown after `elapsed` seconds of walking: on twos, from the key frame. */
export function worldFrameAt(elapsed: number): number {
    return KEY_FRAME + Math.floor((elapsed * RIG_RATE) / MASCOT_HOLD_FRAMES) * MASCOT_HOLD_FRAMES
}

/** The rig frame for a world frame. */
export function rigFrame(wf: number): number {
    return mod(wf, WALK_FRAMES)
}
