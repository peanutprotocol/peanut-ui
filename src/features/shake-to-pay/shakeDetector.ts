export type MotionSample = { x: number | null; y: number | null; z: number | null; t: number }

export type ShakeDetectorOptions = { threshold?: number; minPeaks?: number; windowMs?: number; cooldownMs?: number }

/**
 * Tuned on accelerationIncludingGravity (m/s²). A deliberate shake swings well past
 * 12 m/s² between consecutive samples several times a second; walking stays near
 * 3 and a single knock produces one peak, so neither reaches three in a second.
 */
export const SHAKE_DETECTOR_DEFAULTS = { threshold: 12, minPeaks: 3, windowMs: 1000, cooldownMs: 2000 }

type Vector = { x: number; y: number; z: number }

function toVector(sample: MotionSample): Vector | null {
    const { x, y, z } = sample
    if (![x, y, z, sample.t].every((v) => typeof v === 'number' && Number.isFinite(v))) return null
    return { x: x as number, y: y as number, z: z as number }
}

export function createShakeDetector(options: ShakeDetectorOptions = {}) {
    const { threshold, minPeaks, windowMs, cooldownMs } = { ...SHAKE_DETECTOR_DEFAULTS, ...options }
    let previous: Vector | null = null
    let peaks: number[] = []
    let quietUntil = -Infinity

    return {
        push(sample: MotionSample): boolean {
            const current = toVector(sample)
            if (!current) return false
            const last = previous
            previous = current
            if (!last) return false

            const jerk = Math.hypot(current.x - last.x, current.y - last.y, current.z - last.z)
            if (jerk < threshold || sample.t < quietUntil) return false

            peaks = peaks.filter((t) => sample.t - t < windowMs)
            peaks.push(sample.t)
            if (peaks.length < minPeaks) return false

            peaks = []
            quietUntil = sample.t + cooldownMs
            return true
        },
        reset() {
            previous = null
            peaks = []
            quietUntil = -Infinity
        },
    }
}
