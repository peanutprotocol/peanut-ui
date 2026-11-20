// The two brand curves (globals.css --ease-spring / --ease-sharp) as strings,
// because the Web Animations API cannot read a CSS variable.
export const SPRING = 'cubic-bezier(0.34, 1.56, 0.64, 1)'
export const SHARP = 'cubic-bezier(0.87, 0, 0.13, 1)'
/** Hold the pose, then jump: the hard on/off of a stamp. */
export const HOLD = 'steps(1, end)'

/** One pose: when it is reached (ms), the transform, and the curve to the next pose. */
export type TimelineStep = [at: number, transform: string, easing?: string]

/** Plays one element through its poses over `total` ms and keeps the last pose. */
export function timeline(element: Element, total: number, steps: TimelineStep[]): Animation {
    const keyframes: Keyframe[] = steps.map(([at, transform, easing]) => ({
        offset: Math.min(1, at / total),
        transform,
        easing: easing ?? 'linear',
    }))
    if (steps[0][0] > 0) keyframes.unshift({ offset: 0, transform: steps[0][1], easing: HOLD })
    if (steps[steps.length - 1][0] < total) keyframes.push({ offset: 1, transform: steps[steps.length - 1][1] })
    return element.animate(keyframes, { duration: total, fill: 'both' })
}
