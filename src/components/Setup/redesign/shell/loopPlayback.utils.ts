/** A Lottie comp marker: `cm` is its name, `tm` its first frame, `dr` its length in frames. */
export type LoopMarker = { cm?: string; tm: number; dr?: number }

export type FrameSegment = [number, number]

/**
 * How a sign-up loop plays, read from its markers:
 * - `whole`: no `idle` marker, so the comp loops end to end.
 * - `idle`: only an `idle` marker, so that segment cycles.
 * - `beat`: play the `intro` once, hold the `idle` for LOOP_HOLD_MS, then play the
 *   `outro` (or restart the intro) and repeat. A loop never undoes its own beat with
 *   a hard cut. With `idleOnce` (the comp's `pp.idle_once`), the idle is authored as
 *   the whole hold, so it plays once and runs straight into the outro.
 */
export type LoopPlan =
    | { kind: 'whole' }
    | { kind: 'idle'; idle: FrameSegment }
    | { kind: 'beat'; intro: FrameSegment; idle: FrameSegment; outro: FrameSegment | null; idleOnce: boolean }

/** How long the held pose repeats before the loop plays its beat again. */
export const LOOP_HOLD_MS = 2500

export function planLoop(markers: readonly LoopMarker[] | undefined, totalFrames: number, idleOnce = false): LoopPlan {
    const find = (name: string) => markers?.find((marker) => marker.cm === name)
    const idle = find('idle')
    if (!idle) return { kind: 'whole' }
    const intro = find('intro')
    const outro = find('outro')
    const idleSegment: FrameSegment = [idle.tm, idle.tm + (idle.dr || totalFrames - idle.tm)]
    if (!intro && !outro) return { kind: 'idle', idle: idleSegment }
    return {
        kind: 'beat',
        intro: [intro ? intro.tm : 0, idle.tm],
        idle: idleSegment,
        outro: outro ? [outro.tm, outro.tm + (outro.dr || totalFrames - outro.tm)] : null,
        idleOnce,
    }
}

/** The frame shown under prefers-reduced-motion: the held pose, never mid-beat. */
export function stillFrame(plan: LoopPlan): number {
    return plan.kind === 'whole' ? 0 : plan.idle[0]
}
