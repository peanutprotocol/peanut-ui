import { FOLLOW_THE_PULL } from '../../../../public/dev/knerd/preset'
import type { KnerdEntranceInput, KnerdPullPreset, KnerdSpring, KnerdTargetInput } from './knerdPull.types'

/**
 * Follow the pull, the approved Knerd hero motion: the math of the reference
 * (public/dev/knerd/hero.js), kept line for line. Every tuning number comes
 * from the shared preset; the remaining literals are the reference's own
 * equations. Change nothing here without changing the reference first.
 */
export const KNERD_PULL_PRESET: KnerdPullPreset = FOLLOW_THE_PULL

/** How far a letter rises (px) and how far it leans (deg) on arrival, protecting the copy above and below. */
export function entranceMotion(input: KnerdEntranceInput, preset: KnerdPullPreset = KNERD_PULL_PRESET) {
    const sign = input.index % 2 ? -1 : 1
    // Knerd ink extends above its tight line box; protect the stationary copy during arrival.
    const upClearance = Math.max(0, input.top - input.font * 0.22 - input.leadBottom - 16)
    const downClearance = Math.max(0, input.belowTop - input.bottom - input.font * 0.08 - 16)
    const travel =
        preset.drop < 0
            ? -Math.min(70, Math.abs(preset.drop * input.font), upClearance)
            : Math.min(70, preset.drop * input.font, downClearance)
    const bend = Math.min(Math.abs(preset.rotation), upClearance > 20 ? 8 : 2) * Math.sign(preset.rotation) * sign
    return { travel, bend }
}

const entranceTransform = (y: number, r: number, sx = 1, sy = 1) =>
    `translateY(${y}px) rotate(${r}deg) scale(${sx},${sy})`

/** The arrival keyframes for one glyph. */
export function entranceKeyframes(travel: number, bend: number): Keyframe[] {
    return [
        { transform: entranceTransform(travel, bend, 0.97, 1.04), offset: 0 },
        { transform: entranceTransform(-travel * 0.095, -bend * 0.3, 1.045, 0.945), offset: 0.5 },
        { transform: entranceTransform(travel * 0.13, bend * 0.18), offset: 0.72 },
        { transform: entranceTransform(-travel * 0.02, 0), offset: 0.9 },
        { transform: entranceTransform(0, 0), offset: 1 },
    ]
}

export function entranceTiming(index: number, preset: KnerdPullPreset = KNERD_PULL_PRESET): KeyframeAnimationOptions {
    return {
        duration: preset.duration,
        delay: index * preset.stagger,
        easing: 'cubic-bezier(.33,0,.2,1)',
        fill: 'both',
    }
}

/** Frames elapsed since the last tick, capped at 2; the first frame counts as one. */
export function frameStep(time: number, previousTime: number): number {
    return previousTime ? Math.min(2, (time - previousTime) / 16.667) : 1
}

/** Where the pointer pulls one letter, clamped 12px inside the viewport edges. */
export function magnetTarget(input: KnerdTargetInput, preset: KnerdPullPreset = KNERD_PULL_PRESET) {
    let tx = 0
    let ty = input.entering
        ? 0
        : Math.sin(input.elapsed * 0.018 + input.index * 1.3) * Math.min(4, input.font * preset.idle)
    if (input.pulled && !input.entering) {
        const distance = Math.hypot(input.dx, input.dy)
        const radius = Math.min(preset.radius, input.viewportWidth * 0.42)
        const strength = Math.max(0, 1 - distance / radius) ** 1.4
        const force = Math.min(preset.force, input.font * 0.17) * strength
        const sign = preset.attraction ? -1 : 1
        tx += (input.dx / Math.max(distance, 1)) * force * sign
        ty += (input.dy / Math.max(distance, 1)) * force * sign
    }
    // Reserve room for the font's visible ink and line tilt at both edges.
    tx = Math.max(-Math.max(0, input.left - 12), Math.min(Math.max(0, input.viewportWidth - input.right - 12), tx))
    return { tx, ty }
}

/** One spring step toward the target. Returns the new state and whether the letter is still moving. */
export function springStep(
    state: KnerdSpring,
    tx: number,
    ty: number,
    dt: number,
    preset: KnerdPullPreset = KNERD_PULL_PRESET
): { next: KnerdSpring; moving: boolean } {
    const vx = (state.vx + (tx - state.x) * preset.stiffness * dt) * preset.damping ** dt
    const vy = (state.vy + (ty - state.y) * preset.stiffness * dt) * preset.damping ** dt
    const x = state.x + vx * dt
    const y = state.y + vy * dt
    const moving = Math.abs(x - tx) + Math.abs(y - ty) + Math.abs(vx) + Math.abs(vy) > 0.025
    return { next: { x, y, vx, vy }, moving }
}

export function magnetTransform({ x, y }: KnerdSpring): string {
    return `translate(${x.toFixed(3)}px,${y.toFixed(3)}px) rotate(${(x * 0.075).toFixed(3)}deg)`
}
