import {
    MASCOT_ART_BOXES,
    MASCOT_ART_FILL,
    MASCOT_CANVAS_HEIGHT,
    MASCOT_CANVAS_WIDTH,
    MASCOT_JITTER_FRAMES,
} from './PeanutMascot.consts'
import type { MascotPlacement, MascotPose } from './PeanutMascot.types'

/** Scale and offset the comp canvas so the pose's artwork sits centred in the host box. */
export function getMascotPlacement(pose: MascotPose, hostWidth: number, hostHeight: number): MascotPlacement {
    const art = MASCOT_ART_BOXES[pose]
    const scale = Math.min((hostWidth * MASCOT_ART_FILL) / art.w, (hostHeight * MASCOT_ART_FILL) / art.h)
    return {
        width: MASCOT_CANVAS_WIDTH * scale,
        height: MASCOT_CANVAS_HEIGHT * scale,
        left: hostWidth / 2 - (art.x + art.w / 2) * scale,
        top: hostHeight / 2 - (art.y + art.h / 2) * scale,
    }
}

/** Nudge the held frame to break up an even stutter. */
export function jitterFrame(frame: number, totalFrames: number): number {
    if (MASCOT_JITTER_FRAMES === 0) return frame
    const offset = Math.round((Math.random() * 2 - 1) * MASCOT_JITTER_FRAMES)
    return Math.min(Math.max(frame + offset, 0), totalFrames - 1)
}

type MascotTick = (deltaSeconds: number) => void

const tickers = new Set<MascotTick>()
let frameHandle: number | null = null
let lastFrameTime = 0

function runFrame(now: number): void {
    // Cap the delta so a backgrounded tab does not fast-forward the loop when it returns.
    const delta = Math.min((now - lastFrameTime) / 1000, 0.1)
    lastFrameTime = now
    tickers.forEach((tick) => tick(delta))
    // A ticker can unsubscribe from inside its own tick (a loop={false} pose reaching its
    // last frame). Re-arming unconditionally would leave the loop running with no
    // subscribers, so check again after the ticks rather than before.
    if (tickers.size === 0) {
        frameHandle = null
        return
    }
    frameHandle = requestAnimationFrame(runFrame)
}

/**
 * One rAF loop drives every mascot on the page — several screens render two or more.
 * The loop starts with the first subscriber and stops when the last one leaves.
 */
export function subscribeToMascotClock(tick: MascotTick): () => void {
    tickers.add(tick)
    if (frameHandle === null) {
        lastFrameTime = performance.now()
        frameHandle = requestAnimationFrame(runFrame)
    }
    return () => {
        tickers.delete(tick)
        if (tickers.size === 0 && frameHandle !== null) {
            cancelAnimationFrame(frameHandle)
            frameHandle = null
        }
    }
}
