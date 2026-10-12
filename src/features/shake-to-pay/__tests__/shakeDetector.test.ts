import { createShakeDetector, SHAKE_DETECTOR_DEFAULTS } from '../shakeDetector'
import type { MotionSample, ShakeDetectorOptions } from '../shakeDetector'

type Vec = [number, number, number]

const GRAVITY = 9.81

// ---------------------------------------------------------------------------
// deterministic randomness
// ---------------------------------------------------------------------------

/** mulberry32: small seeded PRNG so a failing run can be replayed from its seed. */
function seeded(seed: number): () => number {
    let a = seed >>> 0
    return () => {
        a = (a + 0x6d2b79f5) >>> 0
        let t = a
        t = Math.imul(t ^ (t >>> 15), t | 1)
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

const between = (rng: () => number, min: number, max: number) => min + rng() * (max - min)
const intBetween = (rng: () => number, min: number, max: number) => Math.floor(between(rng, min, max + 1))

function randomUnitVector(rng: () => number): Vec {
    for (;;) {
        const v: Vec = [between(rng, -1, 1), between(rng, -1, 1), between(rng, -1, 1)]
        const norm = Math.hypot(...v)
        if (norm > 0.1) return [v[0] / norm, v[1] / norm, v[2] / norm]
    }
}

// ---------------------------------------------------------------------------
// synthetic motion traces (accelerationIncludingGravity, m/s^2, t in ms)
// ---------------------------------------------------------------------------

const sampleAt = (t: number, [x, y, z]: Vec): MotionSample => ({ x, y, z, t })

function stillPhone({
    startMs = 0,
    durationMs,
    hz = 60,
    noise = 0.3,
    gravity = [0, 0, GRAVITY],
    rng = seeded(7),
}: {
    startMs?: number
    durationMs: number
    hz?: number
    noise?: number
    gravity?: Vec
    rng?: () => number
}): MotionSample[] {
    const dt = 1000 / hz
    const count = Math.floor(durationMs / dt)
    return Array.from({ length: count }, (_, i) =>
        sampleAt(startMs + i * dt, [
            gravity[0] + between(rng, -noise, noise),
            gravity[1] + between(rng, -noise, noise),
            gravity[2] + between(rng, -noise, noise),
        ])
    )
}

/** Gravity on z plus a periodic swing of `amplitude` on the chosen axes. */
function periodic({
    startMs = 0,
    durationMs,
    hz = 60,
    amplitude,
    freqHz,
    axes,
    wave = 'sine',
}: {
    startMs?: number
    durationMs: number
    hz?: number
    amplitude: number
    freqHz: number
    axes: Array<0 | 1 | 2>
    wave?: 'sine' | 'square'
}): MotionSample[] {
    const dt = 1000 / hz
    const count = Math.floor(durationMs / dt)
    return Array.from({ length: count }, (_, i) => {
        const elapsedMs = i * dt
        const phase = 2 * Math.PI * freqHz * (elapsedMs / 1000)
        // square: flip sign every half period, so the swing is an instantaneous jump of 2 * amplitude
        const swing = wave === 'sine' ? amplitude * Math.sin(phase) : amplitude * (Math.sin(phase) >= 0 ? 1 : -1)
        const v: Vec = [0, 0, GRAVITY]
        for (const axis of axes) v[axis] += swing
        return sampleAt(startMs + elapsedMs, v)
    })
}

const walking = (opts: { startMs?: number; durationMs: number; hz?: number; wave?: 'sine' | 'square' }) =>
    periodic({ amplitude: 3, freqHz: 2, axes: opts.wave === 'square' ? [2] : [0, 1, 2], ...opts })

/** A vigorous shake: alternating +/-amplitude at ~10 Hz for ~0.6 s. */
const vigorousShake = (opts: {
    startMs: number
    durationMs?: number
    hz?: number
    amplitude?: number
    freqHz?: number
    axis?: 0 | 1 | 2
    wave?: 'sine' | 'square'
}) =>
    periodic({
        durationMs: 600,
        amplitude: 17,
        freqHz: 10,
        ...opts,
        axes: [opts.axis ?? 0],
    })

/**
 * One qualifying peak at each of `peakTimes` and nothing else: the phone sits
 * at 0 / 0 / g and toggles x between 0 and `amplitude` exactly at those ticks,
 * so every toggle is a single jump of exactly `amplitude`. Times must be
 * positive multiples of `tickMs`.
 */
function peaksAt(
    peakTimes: number[],
    { amplitude = 15, tickMs = 50, tailMs = 300 }: { amplitude?: number; tickMs?: number; tailMs?: number } = {}
): MotionSample[] {
    const peaks = new Set(peakTimes)
    const end = Math.max(...peakTimes) + tailMs
    const samples: MotionSample[] = []
    let high = false
    for (let t = 0; t <= end; t += tickMs) {
        if (peaks.has(t)) high = !high
        samples.push({ x: high ? amplitude : 0, y: 0, z: GRAVITY, t })
    }
    return samples
}

const concat = (...parts: MotionSample[][]) => parts.flat()

/** Pushes every sample and returns the timestamps of the samples that reported a shake. */
function run(samples: readonly MotionSample[], options?: ShakeDetectorOptions): number[] {
    const detector = createShakeDetector(options)
    const fired: number[] = []
    for (const sample of samples) if (detector.push(sample)) fired.push(sample.t)
    return fired
}

const stillThenShake = (startMs: number, shakeOpts: Partial<Parameters<typeof vigorousShake>[0]> = {}) =>
    concat(
        stillPhone({ durationMs: startMs }),
        vigorousShake({ startMs, ...shakeOpts }),
        stillPhone({ startMs: startMs + 600, durationMs: 2500 })
    )

// ---------------------------------------------------------------------------

describe('SHAKE_DETECTOR_DEFAULTS', () => {
    it('are the documented values', () => {
        expect(SHAKE_DETECTOR_DEFAULTS).toEqual({ threshold: 12, minPeaks: 3, windowMs: 1000, cooldownMs: 2000 })
    })
})

describe('createShakeDetector: motion that must not count as a shake', () => {
    it.each<[string, Vec]>([
        ['flat, face up', [0, 0, GRAVITY]],
        ['flat, face down', [0, 0, -GRAVITY]],
        ['upright in a hand', [0, GRAVITY, 0]],
        ['upside down', [0, -GRAVITY, 0]],
        ['on its side', [GRAVITY, 0, 0]],
        ['on its other side', [-GRAVITY, 0, 0]],
    ])('a phone lying still (%s, noise +/-0.3) never fires in 30 s', (_label, gravity) => {
        expect(run(stillPhone({ durationMs: 30_000, gravity }))).toEqual([])
    })

    it.each([20, 50, 100, 200])('a still phone never fires at %i Hz sampling', (hz) => {
        expect(run(stillPhone({ durationMs: 15_000, hz }))).toEqual([])
    })

    it.each([10, 20, 50, 60, 100])('walking (+/-3 m/s2 at ~2 Hz on every axis) never fires at %i Hz sampling', (hz) => {
        expect(run(walking({ durationMs: 20_000, hz }))).toEqual([])
    })

    it('walking with instantaneous +/-3 swings (the worst case for a sampled swing) never fires', () => {
        expect(run(walking({ durationMs: 20_000, wave: 'square' }))).toEqual([])
    })

    it('walking on top of sensor noise never fires', () => {
        const rng = seeded(11)
        const trace = walking({ durationMs: 20_000 }).map((s) => ({
            ...s,
            x: (s.x as number) + between(rng, -0.3, 0.3),
            y: (s.y as number) + between(rng, -0.3, 0.3),
            z: (s.z as number) + between(rng, -0.3, 0.3),
        }))
        expect(run(trace)).toEqual([])
    })

    it.each([15, 30, 60, 200])('a single bump (one %i m/s2 spike, then calm) never fires', (magnitude) => {
        const trace = stillPhone({ durationMs: 4000 })
        trace[120] = { ...trace[120], z: (trace[120].z as number) + magnitude }
        expect(run(trace)).toEqual([])
    })

    it('a single bump that lasts a few samples never fires', () => {
        const trace = stillPhone({ durationMs: 4000 })
        for (const i of [120, 121, 122, 123]) trace[i] = { ...trace[i], z: (trace[i].z as number) + 30 }
        expect(run(trace)).toEqual([])
    })

    it('a sudden step to a new resting orientation (one jump) never fires', () => {
        const trace = stillPhone({ durationMs: 4000 }).map((s, i) =>
            i < 120 ? s : { ...s, x: (s.x as number) + 25, z: (s.z as number) - 9 }
        )
        expect(run(trace)).toEqual([])
    })

    it('a lone bump every 2 s for 20 s never fires (a bump is at most two peaks in any window)', () => {
        const trace = stillPhone({ durationMs: 20_000 })
        for (let i = 120; i < trace.length; i += 120) trace[i] = { ...trace[i], z: (trace[i].z as number) + 30 }
        expect(run(trace)).toEqual([])
    })

    it('slow big movements, one every 600 ms (only two fit in the window), never fire', () => {
        expect(run(peaksAt([200, 800, 1400, 2000, 2600, 3200, 3800, 4400]))).toEqual([])
    })
})

describe('createShakeDetector: a vigorous shake', () => {
    it.each<[string, 'square' | 'sine', number, number, 0 | 1 | 2]>([
        ['square wave, 60 Hz sampling, 15', 'square', 60, 15, 0],
        ['square wave, 60 Hz sampling, 17', 'square', 60, 17, 1],
        ['square wave, 60 Hz sampling, 20', 'square', 60, 20, 2],
        ['square wave, 50 Hz sampling, 15', 'square', 50, 15, 0],
        ['square wave, 50 Hz sampling, 20', 'square', 50, 20, 1],
        ['sine, 60 Hz sampling, 15', 'sine', 60, 15, 0],
        ['sine, 60 Hz sampling, 20', 'sine', 60, 20, 1],
        ['sine, 60 Hz sampling, 20 on z', 'sine', 60, 20, 2],
    ])('(%s) fires exactly once, soon after it starts', (_label, wave, hz, amplitude, axis) => {
        const startMs = 1500
        const fired = run(stillThenShake(startMs, { wave, hz, amplitude, axis }))

        expect(fired).toHaveLength(1)
        expect(fired[0]).toBeGreaterThanOrEqual(startMs)
        expect(fired[0]).toBeLessThanOrEqual(startMs + 400)
    })

    it('fires exactly once when a shake starts at the very beginning of the stream', () => {
        const fired = run(concat(vigorousShake({ startMs: 0 }), stillPhone({ startMs: 600, durationMs: 3000 })))
        expect(fired).toHaveLength(1)
    })

    it('fires exactly once when the shake runs a second longer than the usual 0.6 s', () => {
        const fired = run(
            concat(
                stillPhone({ durationMs: 1000 }),
                vigorousShake({ startMs: 1000, durationMs: 1600 }),
                stillPhone({ startMs: 2600, durationMs: 3000 })
            )
        )
        expect(fired).toHaveLength(1)
    })

    it('fires once per shake for two shakes 3 s apart', () => {
        const trace = concat(
            stillPhone({ durationMs: 1000 }),
            vigorousShake({ startMs: 1000 }),
            stillPhone({ startMs: 1600, durationMs: 2400 }),
            vigorousShake({ startMs: 4000 }),
            stillPhone({ startMs: 4600, durationMs: 2000 })
        )
        const fired = run(trace)

        expect(fired).toHaveLength(2)
        expect(fired[0]).toBeGreaterThanOrEqual(1000)
        expect(fired[0]).toBeLessThanOrEqual(1400)
        expect(fired[1]).toBeGreaterThanOrEqual(4000)
        expect(fired[1]).toBeLessThanOrEqual(4400)
    })

    it('fires once per shake for two shakes 2.5 s apart (the 2 s cooldown has elapsed)', () => {
        const trace = concat(
            stillPhone({ durationMs: 1000 }),
            vigorousShake({ startMs: 1000 }),
            stillPhone({ startMs: 1600, durationMs: 1900 }),
            vigorousShake({ startMs: 3500 }),
            stillPhone({ startMs: 4100, durationMs: 2000 })
        )
        expect(run(trace)).toHaveLength(2)
    })

    it('fires only once for two shakes 1 s apart: the second falls inside the cooldown', () => {
        const trace = concat(
            stillPhone({ durationMs: 1000 }),
            vigorousShake({ startMs: 1000 }),
            stillPhone({ startMs: 1600, durationMs: 400 }),
            vigorousShake({ startMs: 2000 }),
            stillPhone({ startMs: 2600, durationMs: 3000 })
        )
        expect(run(trace)).toHaveLength(1)
    })

    it('a shake right after a long calm spell still fires', () => {
        expect(run(stillThenShake(60_000))).toHaveLength(1)
    })
})

describe('createShakeDetector: peak counting', () => {
    it('reports on the very sample that brings the peak count in the window to minPeaks', () => {
        expect(run(peaksAt([200, 650, 1100]))).toEqual([1100])
    })

    it('does not report while fewer than minPeaks peaks are in the window', () => {
        expect(run(peaksAt([200, 650]))).toEqual([])
    })

    it('counts an irregular burst whose peaks all fit inside the window', () => {
        expect(run(peaksAt([200, 900, 1100]))).toEqual([1100])
    })

    it('drops peaks that have left the trailing window before counting', () => {
        // 200 has expired by 1500; the first time three peaks coexist is 1300 / 1500 / 1700
        expect(run(peaksAt([200, 1300, 1500, 1700]))).toEqual([1700])
    })

    it('never fires when no three peaks ever fit in one window, however long it goes on', () => {
        expect(run(peaksAt(Array.from({ length: 30 }, (_, i) => 200 + i * 600)))).toEqual([])
    })

    it('a jump of exactly the threshold is a peak (jerk >= threshold)', () => {
        expect(run(peaksAt([100, 200, 300], { amplitude: SHAKE_DETECTOR_DEFAULTS.threshold }))).toEqual([300])
    })

    it('a jump just under the threshold is not a peak', () => {
        expect(run(peaksAt([100, 200, 300], { amplitude: SHAKE_DETECTOR_DEFAULTS.threshold - 0.01 }))).toEqual([])
    })

    it('measures the jump as the Euclidean distance over all three axes', () => {
        // each step is (7, 7, 7) = 12.12 m/s2 in 3D, but only 7 along any single axis
        const toggle = (high: boolean): Vec => (high ? [7, 7, GRAVITY + 7] : [0, 0, GRAVITY])
        const samples = [0, 100, 200, 300, 400].map((t, i) => sampleAt(t, toggle(i % 2 === 1)))
        // prime, then four jumps: the third jump (t = 300) completes the burst
        expect(run(samples)).toEqual([300])
    })

    it('measures jerk against the previous sample, not against gravity or a baseline', () => {
        // a phone held at a steep tilt (large constant offset) has zero jerk
        const tilted = Array.from({ length: 300 }, (_, i) => sampleAt(i * 20, [8, 5, 3]))
        expect(run(tilted)).toEqual([])
    })
})

describe('createShakeDetector: cooldown', () => {
    it('stays quiet for cooldownMs after a report, then reports again', () => {
        const fired = run(peaksAt([1000, 1300, 1700, 2500, 3500]), { minPeaks: 1 })
        expect(fired).toEqual([1000, 3500])
    })

    it('a custom cooldownMs is honoured', () => {
        const fired = run(peaksAt([1000, 1300, 1700]), { minPeaks: 1, cooldownMs: 500 })
        expect(fired).toEqual([1000, 1700])
    })

    it('clears the peak history when it reports: peaks that led to a report do not count towards the next one', () => {
        // cooldown (300 ms) ends well inside the window (1000 ms), so stale peaks would still be in it
        const fired = run(peaksAt([1000, 1100, 1200, 1600, 1700]), { cooldownMs: 300 })
        expect(fired).toEqual([1200])
    })

    it('peaks during the cooldown are never reported, and the next burst after it is found', () => {
        const fired = run(peaksAt([1000, 1200, 1400, 1600, 3300, 3400, 3500]), { minPeaks: 2, cooldownMs: 2000 })
        expect(fired).toEqual([1200, 3400])
    })
})

describe('createShakeDetector: options', () => {
    it('minPeaks can be lowered: a spike up and back down (two peaks) fires with minPeaks 2 but not by default', () => {
        const spike = [
            sampleAt(0, [0, 0, GRAVITY]),
            sampleAt(100, [0, 0, GRAVITY]),
            sampleAt(200, [0, 0, GRAVITY + 30]),
            sampleAt(300, [0, 0, GRAVITY]),
            sampleAt(400, [0, 0, GRAVITY]),
        ]
        expect(run(spike)).toEqual([])
        expect(run(spike, { minPeaks: 2 })).toEqual([300])
    })

    it('minPeaks 1 reports on the first jump', () => {
        expect(run(peaksAt([200, 400]), { minPeaks: 1 })[0]).toBe(200)
    })

    it('threshold is configurable: motion below it does not count, motion above it does', () => {
        const trace = peaksAt([100, 200, 300], { amplitude: 8 })
        expect(run(trace)).toEqual([])
        expect(run(trace, { threshold: 6 })).toEqual([300])
    })

    it('threshold can be set above a vigorous shake so nothing fires', () => {
        expect(run(stillThenShake(1000), { threshold: 100 })).toEqual([])
    })

    it('windowMs can be shortened so slower bursts no longer count', () => {
        const trace = peaksAt([200, 650, 1100])
        expect(run(trace)).toEqual([1100])
        expect(run(trace, { windowMs: 300 })).toEqual([])
    })

    it('windowMs can be lengthened so slower bursts count', () => {
        const trace = peaksAt([200, 900, 1600])
        expect(run(trace)).toEqual([])
        expect(run(trace, { windowMs: 2000 })).toEqual([1600])
    })
})

describe('createShakeDetector: samples it must ignore', () => {
    const goodSample = sampleAt(0, [0, 0, GRAVITY])

    // the other axes are huge, so a sample that was NOT ignored would register a peak
    const badSamples: Array<[string, MotionSample]> = [
        ['null x', { x: null, y: 80, z: 80, t: 10 }],
        ['null y', { x: 80, y: null, z: 80, t: 10 }],
        ['null z', { x: 80, y: 80, z: null, t: 10 }],
        ['all axes null', { x: null, y: null, z: null, t: 10 }],
        ['NaN x', { x: NaN, y: 80, z: 80, t: 10 }],
        ['NaN y', { x: 80, y: NaN, z: 80, t: 10 }],
        ['NaN z', { x: 80, y: 80, z: NaN, t: 10 }],
        ['Infinity x', { x: Infinity, y: 80, z: 80, t: 10 }],
        ['-Infinity y', { x: 80, y: -Infinity, z: 80, t: 10 }],
        ['Infinity z', { x: 80, y: 80, z: Infinity, t: 10 }],
    ]

    const pushOnce = (detector: ReturnType<typeof createShakeDetector>, sample: MotionSample) => {
        let result: boolean | undefined
        expect(() => {
            result = detector.push(sample)
        }).not.toThrow()
        return result
    }

    it.each(badSamples)('%s: returns false without throwing and leaves the detector exactly as it was', (_l, bad) => {
        const detector = createShakeDetector({ minPeaks: 1 })
        detector.push(goodSample)

        expect(pushOnce(detector, bad)).toBe(false)

        // still primed on goodSample, so this 20 m/s2 jump counts
        expect(detector.push(sampleAt(100, [20, 0, GRAVITY]))).toBe(true)
    })

    it.each(badSamples)(
        '%s as the very first sample: ignored, so the next valid sample still only primes',
        (_l, bad) => {
            const detector = createShakeDetector({ minPeaks: 1 })

            expect(pushOnce(detector, bad)).toBe(false)
            expect(detector.push(goodSample)).toBe(false)
            expect(detector.push(sampleAt(100, [20, 0, GRAVITY]))).toBe(true)
        }
    )

    it('a non-finite timestamp is ignored too, without throwing or counting', () => {
        const detector = createShakeDetector({ minPeaks: 1 })
        detector.push(goodSample)

        expect(pushOnce(detector, { x: 40, y: 0, z: GRAVITY, t: NaN })).toBe(false)
        expect(pushOnce(detector, { x: 40, y: 0, z: GRAVITY, t: Infinity })).toBe(false)

        expect(detector.push(sampleAt(100, [20, 0, GRAVITY]))).toBe(true)
    })

    it('does not reset the peak history: invalid samples in the middle of a burst are transparent', () => {
        const clean = stillThenShake(1000)
        const noisy = clean.flatMap((s, i) => {
            const garbage: MotionSample[] = [
                { x: null, y: 99, z: 99, t: s.t + 1 },
                { x: NaN, y: NaN, z: NaN, t: s.t + 2 },
                { x: Infinity, y: 0, z: 0, t: s.t + 3 },
            ]
            return i % 2 === 0 ? [s, ...garbage] : [s]
        })

        expect(run(noisy)).toEqual(run(clean))
        expect(run(clean)).toHaveLength(1)
    })

    it('does not reset the previous sample: the next jump is measured against the last VALID sample', () => {
        const detector = createShakeDetector({ minPeaks: 1 })
        expect(detector.push(sampleAt(0, [0, 0, GRAVITY]))).toBe(false)
        expect(detector.push({ x: null, y: null, z: null, t: 50 })).toBe(false)
        expect(detector.push(sampleAt(100, [20, 0, GRAVITY]))).toBe(true)
    })

    it('an invalid sample does not prime the detector: the first VALID sample still only primes', () => {
        const detector = createShakeDetector({ minPeaks: 1 })
        expect(detector.push({ x: null, y: 0, z: 0, t: 0 })).toBe(false)
        expect(detector.push({ x: NaN, y: 0, z: 0, t: 10 })).toBe(false)
        // would be a huge jump if an invalid sample had been read as zeros
        expect(detector.push(sampleAt(20, [50, 50, 50]))).toBe(false)
        expect(detector.push(sampleAt(30, [0, 0, 0]))).toBe(true)
    })

    it('an invalid sample inside the cooldown does not extend or end it', () => {
        const detector = createShakeDetector({ minPeaks: 1, cooldownMs: 2000 })
        detector.push(sampleAt(0, [0, 0, GRAVITY]))
        expect(detector.push(sampleAt(100, [20, 0, GRAVITY]))).toBe(true)
        expect(detector.push({ x: null, y: null, z: null, t: 1500 })).toBe(false)
        expect(detector.push(sampleAt(1600, [0, 0, GRAVITY]))).toBe(false)
        expect(detector.push(sampleAt(2300, [20, 0, GRAVITY]))).toBe(true)
    })
})

describe('createShakeDetector: reset()', () => {
    it('clears the cooldown: the shake that is still going on is reported again right after reset()', () => {
        const trace = stillThenShake(1000)

        const withoutReset = createShakeDetector()
        expect(trace.filter((s) => withoutReset.push(s))).toHaveLength(1)

        const detector = createShakeDetector()
        let resetDone = false
        const fired: number[] = []
        for (const s of trace) {
            if (!detector.push(s)) continue
            fired.push(s.t)
            if (!resetDone) {
                detector.reset()
                resetDone = true
            }
        }
        expect(fired).toHaveLength(2)
        expect(fired[0]).toBeLessThan(1600)
        expect(fired[1]).toBeLessThan(1600)
    })

    it('clears the peak history', () => {
        const sequence = [
            sampleAt(0, [0, 0, GRAVITY]), // prime
            sampleAt(100, [15, 0, GRAVITY]), // peak 1
            sampleAt(200, [0, 0, GRAVITY]), // peak 2
        ]

        const control = createShakeDetector()
        sequence.forEach((s) => control.push(s))
        control.push(sampleAt(300, [0, 0, GRAVITY]))
        expect(control.push(sampleAt(400, [15, 0, GRAVITY]))).toBe(true) // peak 3, history intact

        const detector = createShakeDetector()
        sequence.forEach((s) => detector.push(s))
        detector.reset()
        detector.push(sampleAt(300, [0, 0, GRAVITY]))
        expect(detector.push(sampleAt(400, [15, 0, GRAVITY]))).toBe(false) // only peak 1 since reset
    })

    it('clears the previous sample: the first sample after reset only primes', () => {
        const detector = createShakeDetector({ minPeaks: 1 })
        detector.push(sampleAt(0, [0, 0, GRAVITY]))
        detector.reset()
        expect(detector.push(sampleAt(100, [40, 0, GRAVITY]))).toBe(false)
        expect(detector.push(sampleAt(200, [0, 0, GRAVITY]))).toBe(true)
    })

    it('is harmless on a fresh detector and when called repeatedly', () => {
        const detector = createShakeDetector()
        expect(() => {
            detector.reset()
            detector.reset()
        }).not.toThrow()
        const fired = stillThenShake(1000).filter((s) => detector.push(s))
        expect(fired).toHaveLength(1)
    })
})

describe('createShakeDetector: instances', () => {
    it('keep independent state', () => {
        const a = createShakeDetector({ minPeaks: 1 })
        const b = createShakeDetector({ minPeaks: 1 })
        a.push(sampleAt(0, [0, 0, GRAVITY]))
        // b has seen nothing: its first sample only primes, even though a is primed and cooled down
        expect(b.push(sampleAt(100, [40, 0, GRAVITY]))).toBe(false)
        expect(a.push(sampleAt(100, [40, 0, GRAVITY]))).toBe(true)
        expect(b.push(sampleAt(200, [0, 0, GRAVITY]))).toBe(true)
    })

    it('does not use wall-clock time: only the sample timestamps matter', () => {
        const base = 9_000_000_000_000
        const shifted = stillThenShake(1000).map((s) => ({ ...s, t: s.t + base }))
        expect(run(shifted)).toHaveLength(1)
    })
})

describe('createShakeDetector: randomized checks (seeded)', () => {
    it('low-amplitude noise never fires: jerk is always below the threshold (200 seeded runs)', () => {
        for (let seed = 1; seed <= 200; seed++) {
            const rng = seeded(seed)
            const threshold = between(rng, 4, 20)
            const options: ShakeDetectorOptions = {
                threshold,
                minPeaks: intBetween(rng, 1, 4),
                windowMs: intBetween(rng, 200, 2000),
                cooldownMs: intBetween(rng, 100, 3000),
            }

            let v: Vec = [between(rng, -20, 20), between(rng, -20, 20), between(rng, -20, 20)]
            let t = intBetween(rng, 0, 1_000_000)
            const samples: MotionSample[] = [sampleAt(t, v)]
            for (let i = 0; i < 300; i++) {
                const direction = randomUnitVector(rng)
                const magnitude = rng() < 0.1 ? 0 : between(rng, 0, 0.95 * threshold)
                v = [v[0] + direction[0] * magnitude, v[1] + direction[1] * magnitude, v[2] + direction[2] * magnitude]
                t += intBetween(rng, 5, 60)
                samples.push(sampleAt(t, v))
            }

            expect({ seed, options, fired: run(samples, options) }).toEqual({ seed, options, fired: [] })
        }
    })

    it('reports exactly on the minPeaks-th qualifying peak and never before (200 seeded runs)', () => {
        for (let seed = 1; seed <= 200; seed++) {
            const rng = seeded(seed * 7919)
            const threshold = between(rng, 4, 20)
            const minPeaks = intBetween(rng, 1, 5)
            const windowMs = intBetween(rng, 300, 2000)
            const options: ShakeDetectorOptions = { threshold, minPeaks, windowMs, cooldownMs: 2000 }

            // plan: prime, then `minPeaks` peaks with 0-3 quiet samples between them, then a quiet tail
            const plan: Array<'peak' | 'quiet'> = []
            for (let p = 0; p < minPeaks; p++) {
                plan.push('peak')
                if (p < minPeaks - 1) for (let q = intBetween(rng, 0, 3); q > 0; q--) plan.push('quiet')
            }
            const spanSteps = Math.max(plan.length - 1, 1)
            // every peak lands within 0.7 of the window of the first one
            const dt = (0.7 * windowMs) / spanSteps
            const lastPeakIndex = plan.length // index in `samples` (prime is 0)
            for (let q = 0; q < 4; q++) plan.push('quiet')

            let v: Vec = [between(rng, -20, 20), between(rng, -20, 20), between(rng, -20, 20)]
            let t = intBetween(rng, 0, 1_000_000)
            const samples: MotionSample[] = [sampleAt(t, v)]
            for (const kind of plan) {
                const direction = randomUnitVector(rng)
                const magnitude =
                    kind === 'peak' ? between(rng, 1.1 * threshold, 3 * threshold) : between(rng, 0, 0.5 * threshold)
                v = [v[0] + direction[0] * magnitude, v[1] + direction[1] * magnitude, v[2] + direction[2] * magnitude]
                t += dt
                samples.push(sampleAt(t, v))
            }

            const detector = createShakeDetector(options)
            const results = samples.map((s) => detector.push(s))
            const expected = samples.map((_, i) => i === lastPeakIndex)

            expect({ seed, options, results }).toEqual({ seed, options, results: expected })
        }
    })

    it('arbitrary garbage samples never throw and always return a boolean (200 seeded runs)', () => {
        const awkward = [null, NaN, Infinity, -Infinity, 0, -0, 1e308, -1e308, 5e-324, 9.81, -9.81, 123456.789]
        for (let seed = 1; seed <= 200; seed++) {
            const rng = seeded(seed * 104729)
            const detector = createShakeDetector({ minPeaks: intBetween(rng, 1, 4) })
            const pick = () => awkward[intBetween(rng, 0, awkward.length - 1)]
            for (let i = 0; i < 100; i++) {
                const sample = {
                    x: pick(),
                    y: pick(),
                    z: pick(),
                    t: rng() < 0.9 ? i * 16 : (pick() as number),
                } as MotionSample
                let result: unknown
                expect(() => {
                    result = detector.push(sample)
                }).not.toThrow()
                expect(typeof result).toBe('boolean')
            }
        }
    })
})
