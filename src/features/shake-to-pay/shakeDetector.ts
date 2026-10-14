type SensorVector = { x: number | null; y: number | null; z: number | null }
type RotationVector = { alpha: number | null; beta: number | null; gamma: number | null }

export type MotionSample = SensorVector & {
    t: number
    linear?: SensorVector | null
    rotation?: RotationVector | null
}

export type ShakeMode = 'vigorous' | 'gentle' | 'twist' | 'bump' | 'circular'

type PeakOptions = { threshold: number; minPeaks: number; windowMs: number; minPeakGapMs: number }
type BumpOptions = { threshold: number; releaseThreshold: number; maxDurationMs: number }
type CircularOptions = { threshold: number; minDegrees: number; windowMs: number; maxStepDegrees: number }

export type ShakeDetectorOptions = Partial<PeakOptions> & {
    modes?: ShakeMode[]
    cooldownMs?: number
    gravityTauMs?: number
    gentle?: Partial<PeakOptions>
    twist?: Partial<PeakOptions>
    bump?: Partial<BumpOptions>
    circular?: Partial<CircularOptions>
}

export const SHAKE_DETECTOR_DEFAULTS = {
    threshold: 9,
    minPeaks: 3,
    windowMs: 1000,
    cooldownMs: 1500,
    minPeakGapMs: 80,
    gravityTauMs: 250,
    gentle: { threshold: 4.25, minPeaks: 5, windowMs: 2000, minPeakGapMs: 100 },
    twist: { threshold: 200, minPeaks: 3, windowMs: 1200, minPeakGapMs: 80 },
    bump: { threshold: 25, releaseThreshold: 8, maxDurationMs: 150 },
    circular: { threshold: 5, minDegrees: 540, windowMs: 1500, maxStepDegrees: 90 },
}

type Vector = { x: number; y: number; z: number }
type Peak = Vector & { t: number }
type TwistPeak = { t: number; axis: keyof Vector; sign: number }
type AngularStep = { t: number; degrees: number }

function toVector(sample: SensorVector | null | undefined): Vector | null {
    if (!sample) return null
    const { x, y, z } = sample
    if (![x, y, z].every((v) => typeof v === 'number' && Number.isFinite(v))) return null
    return { x: x as number, y: y as number, z: z as number }
}

function magnitude(vector: Vector): number {
    return Math.hypot(vector.x, vector.y, vector.z)
}

function addPeak(peaks: Peak[], linear: Vector, t: number, options: PeakOptions): boolean {
    if (magnitude(linear) < options.threshold) return false
    const previous = peaks[peaks.length - 1]
    if (previous) {
        const dot = linear.x * previous.x + linear.y * previous.y + linear.z * previous.z
        if (!(dot < 0) || t - previous.t < options.minPeakGapMs) return false
    }
    peaks.push({ ...linear, t })
    return peaks.length >= options.minPeaks
}

export function createShakeDetector(options: ShakeDetectorOptions = {}) {
    const enabledModes = new Set<ShakeMode>(options.modes ?? ['vigorous', 'gentle', 'twist', 'bump', 'circular'])
    const vigorous = { ...SHAKE_DETECTOR_DEFAULTS, ...options }
    const gentle = { ...SHAKE_DETECTOR_DEFAULTS.gentle, ...options.gentle }
    const twist = { ...SHAKE_DETECTOR_DEFAULTS.twist, ...options.twist }
    const bump = { ...SHAKE_DETECTOR_DEFAULTS.bump, ...options.bump }
    const circular = { ...SHAKE_DETECTOR_DEFAULTS.circular, ...options.circular }
    const { cooldownMs, gravityTauMs } = vigorous
    let gravity: Vector | null = null
    let lastGravityT: number | null = null
    let lastT: number | null = null
    let vigorousPeaks: Peak[] = []
    let gentlePeaks: Peak[] = []
    let twistPeaks: TwistPeak[] = []
    let bumpStart: number | null = null
    let bumpAvailable = true
    let circlePrevious: { t: number; angle: number; qualified: boolean } | null = null
    let circleLastQualifiedT: number | null = null
    let circleSteps: AngularStep[] = []
    let circleDirection = 0
    let quietUntil = -Infinity
    let mode: ShakeMode | null = null

    function clearHistories() {
        vigorousPeaks = []
        gentlePeaks = []
        twistPeaks = []
        bumpStart = null
        bumpAvailable = true
        circlePrevious = null
        circleLastQualifiedT = null
        circleSteps = []
        circleDirection = 0
    }

    function fire(nextMode: ShakeMode, t: number): boolean {
        mode = nextMode
        quietUntil = t + cooldownMs
        clearHistories()
        return true
    }

    function updateCircle(linear: Vector, t: number): { reserved: boolean; complete: boolean } {
        if (circleLastQualifiedT !== null && t - circleLastQualifiedT > Math.min(200, circular.windowMs)) {
            circlePrevious = null
            circleSteps = []
            circleDirection = 0
        }
        const strength = Math.hypot(linear.x, linear.y)
        const qualified = strength >= circular.threshold
        if (strength === 0) {
            circlePrevious = null
            circleSteps = []
            circleDirection = 0
            return { reserved: false, complete: false }
        }
        if (qualified) circleLastQualifiedT = t
        const angle = (Math.atan2(linear.y, linear.x) * 180) / Math.PI
        const previous = circlePrevious
        circlePrevious = { t, angle, qualified }
        if (!previous) return { reserved: circleSteps.length > 0, complete: false }
        if (t - previous.t > circular.windowMs) {
            circleSteps = []
            circleDirection = 0
            return { reserved: false, complete: false }
        }
        const step = ((angle - previous.angle + 540) % 360) - 180
        if (Math.abs(step) > circular.maxStepDegrees) {
            circleSteps = []
            circleDirection = 0
            return { reserved: false, complete: false }
        }
        if (Math.abs(step) > 1e-9) {
            const direction = Math.sign(step)
            if (circleDirection !== direction) circleSteps = []
            circleDirection = direction
            if (qualified && previous.qualified) circleSteps.push({ t: previous.t, degrees: Math.abs(step) })
        }
        const degrees = circleSteps.reduce((total, entry) => total + entry.degrees, 0)
        return { reserved: circleSteps.length > 0, complete: qualified && degrees + 1e-9 >= circular.minDegrees }
    }

    return {
        push(sample: MotionSample): boolean {
            const current = toVector(sample)
            const osLinear = toVector(sample.linear)
            const rotation = sample.rotation
                ? toVector({ x: sample.rotation.alpha, y: sample.rotation.beta, z: sample.rotation.gamma })
                : null
            if (
                !Number.isFinite(sample.t) ||
                (lastT !== null && sample.t <= lastT) ||
                (!current && !osLinear && !rotation)
            ) {
                return false
            }
            lastT = sample.t
            let linear = osLinear
            if (current) {
                if (!gravity || lastGravityT === null) {
                    gravity = current
                } else {
                    const dt = Math.min(200, Math.max(1, sample.t - lastGravityT))
                    const alpha = gravityTauMs / (gravityTauMs + dt)
                    gravity = {
                        x: alpha * gravity.x + (1 - alpha) * current.x,
                        y: alpha * gravity.y + (1 - alpha) * current.y,
                        z: alpha * gravity.z + (1 - alpha) * current.z,
                    }
                }
                lastGravityT = sample.t
                // Integrate gravity before deriving fallback acceleration.
                linear ??= { x: current.x - gravity.x, y: current.y - gravity.y, z: current.z - gravity.z }
            }
            if (sample.t < quietUntil) return false

            if (enabledModes.has('vigorous')) {
                vigorousPeaks = vigorousPeaks.filter((peak) => sample.t - peak.t <= vigorous.windowMs)
            }
            if (enabledModes.has('gentle'))
                gentlePeaks = gentlePeaks.filter((peak) => sample.t - peak.t <= gentle.windowMs)
            if (enabledModes.has('twist')) twistPeaks = twistPeaks.filter((peak) => sample.t - peak.t <= twist.windowMs)
            if (enabledModes.has('circular'))
                circleSteps = circleSteps.filter((step) => sample.t - step.t <= circular.windowMs)
            if (enabledModes.has('bump') && bumpStart !== null && sample.t - bumpStart > bump.maxDurationMs)
                bumpStart = null

            if (linear) {
                if (enabledModes.has('bump')) {
                    const strength = magnitude(linear)
                    if (bumpStart !== null && strength < bump.releaseThreshold) return fire('bump', sample.t)
                    if (strength < bump.releaseThreshold) bumpAvailable = true
                    const previousPeak = vigorousPeaks[vigorousPeaks.length - 1]
                    const reversesPeak =
                        previousPeak &&
                        linear.x * previousPeak.x + linear.y * previousPeak.y + linear.z * previousPeak.z < 0
                    // A second high lobe belongs to an oscillating shake, rather than an isolated bump.
                    if (strength >= vigorous.threshold && reversesPeak) bumpStart = null
                    if (bumpAvailable && strength >= bump.threshold) {
                        bumpAvailable = false
                        if (!reversesPeak && vigorousPeaks.length < 2) bumpStart = sample.t
                    }
                }
                const circle = enabledModes.has('circular')
                    ? updateCircle(linear, sample.t)
                    : { reserved: false, complete: false }
                if (circle.complete) return fire('circular', sample.t)
                if (circle.reserved) {
                    vigorousPeaks = []
                    gentlePeaks = []
                } else {
                    if (enabledModes.has('vigorous') && addPeak(vigorousPeaks, linear, sample.t, vigorous))
                        return fire('vigorous', sample.t)
                    if (enabledModes.has('gentle') && addPeak(gentlePeaks, linear, sample.t, gentle))
                        return fire('gentle', sample.t)
                }
            }
            if (enabledModes.has('twist') && rotation && magnitude(rotation) >= twist.threshold) {
                const axis = (['x', 'y', 'z'] as const).reduce((dominant, candidate) =>
                    Math.abs(rotation[candidate]) > Math.abs(rotation[dominant]) ? candidate : dominant
                )
                const sign = Math.sign(rotation[axis])
                const previous = twistPeaks[twistPeaks.length - 1]
                if (
                    !previous ||
                    (previous.axis === axis && previous.sign !== sign && sample.t - previous.t >= twist.minPeakGapMs)
                ) {
                    twistPeaks.push({ t: sample.t, axis, sign })
                    if (twistPeaks.length >= twist.minPeaks) return fire('twist', sample.t)
                }
            }
            return false
        },
        lastMode(): ShakeMode | null {
            return mode
        },
        reset() {
            gravity = null
            lastGravityT = null
            lastT = null
            quietUntil = -Infinity
            mode = null
            clearHistories()
        },
    }
}
