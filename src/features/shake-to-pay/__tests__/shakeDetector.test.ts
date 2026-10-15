import { act, renderHook } from '@testing-library/react'
import { useShakeMotion } from '../useShakeMotion'
import {
    createShakeDetector as createDetector,
    SHAKE_DETECTOR_DEFAULTS,
    type MotionSample,
    type ShakeDetectorOptions,
    type ShakeMode,
} from '../shakeDetector'

type Vector = [number, number, number]
type Axis = 0 | 1 | 2
type Shake = { start: number; duration: number; amplitude: number; frequency: number; axis: Axis }

const rates = [30, 60, 100]
const axes: { name: string; axis: Axis }[] = [
    { name: 'x', axis: 0 },
    { name: 'y', axis: 1 },
    { name: 'gravity z', axis: 2 },
]
const gravity: Vector = [0, 0, 9.81]
const stableGravity = { gravityTauMs: 1e12 }
const onlyVigorousOptions: ShakeDetectorOptions = {
    gentle: { threshold: Infinity },
    twist: { threshold: Infinity },
    bump: { threshold: Infinity },
    circular: { threshold: Infinity },
}
const createShakeDetector = createDetector
const createVigorousDetector = (options?: ShakeDetectorOptions) =>
    createDetector({ ...onlyVigorousOptions, ...options })

function seededRandom(seed: number): () => number {
    let state = seed >>> 0
    return () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0
        return state / 0x100000000
    }
}

function sample(t: number, x = 0, y = 0, z = 9.81): MotionSample {
    return { t, x, y, z }
}

function trace(
    rate: number,
    duration: number,
    acceleration: (seconds: number, index: number) => Vector,
    noise = 0,
    seed = 42
): MotionSample[] {
    const random = seededRandom(seed)
    return Array.from({ length: Math.floor(duration * rate) + 1 }, (_, index) => {
        const seconds = index / rate
        const vector = acceleration(seconds, index).map((value) => value + (random() * 2 - 1) * noise)
        return sample(seconds * 1000, vector[0], vector[1], vector[2])
    })
}

function shakeTrace(rate: number, shakes: Shake[]): MotionSample[] {
    const end = Math.max(...shakes.map((shake) => shake.start + shake.duration)) + 2
    return trace(rate, end, (seconds) => {
        const vector: Vector = [...gravity]
        for (const shake of shakes) {
            if (seconds >= shake.start && seconds <= shake.start + shake.duration) {
                vector[shake.axis] +=
                    shake.amplitude * Math.sin(2 * Math.PI * shake.frequency * (seconds - shake.start))
            }
        }
        return vector
    })
}

type Fire = { index: number; t: number; mode: ShakeMode | null }

function withLinear(samples: MotionSample[]): MotionSample[] {
    return samples.map((value) => ({
        ...value,
        linear: { x: value.x, y: value.y, z: (value.z ?? 9.81) - 9.81 },
    }))
}

function fires(samples: MotionSample[], options?: ShakeDetectorOptions): Fire[] {
    const detector = createShakeDetector(options)
    return samples.flatMap((value, index) =>
        detector.push(value) ? [{ index, t: value.t, mode: detector.lastMode() }] : []
    )
}

function vigorousFires(samples: MotionSample[], options?: ShakeDetectorOptions): Fire[] {
    return fires(samples, { ...onlyVigorousOptions, ...options })
}

function expectInside(
    events: { index: number; t: number }[],
    samples: MotionSample[],
    intervals: { start: number; duration: number }[]
): void {
    expect(events).toHaveLength(intervals.length)
    for (const [index, interval] of intervals.entries()) {
        const event = events[index]
        expect(event.index).toBeGreaterThan(0)
        expect(event.index).toBeLessThan(samples.length - 1)
        expect(event.t).toBe(samples[event.index].t)
        expect(event.t).toBeGreaterThanOrEqual(interval.start * 1000)
        expect(event.t).toBeLessThanOrEqual((interval.start + interval.duration) * 1000)
    }
}

describe('shake detector physical motion acceptance', () => {
    const orientations: { name: string; vector: Vector }[] = [
        { name: '+x', vector: [9.81, 0, 0] },
        { name: '-x', vector: [-9.81, 0, 0] },
        { name: '+y', vector: [0, 9.81, 0] },
        { name: '-y', vector: [0, -9.81, 0] },
        { name: '+z', vector: [0, 0, 9.81] },
        { name: '-z', vector: [0, 0, -9.81] },
    ]

    it.each(rates.flatMap((rate) => orientations.map((orientation) => ({ rate, ...orientation }))))(
        'does not fire while still in $name orientation at $rate Hz with noise',
        ({ rate, vector }) => {
            expect(fires(trace(rate, 10, () => vector, 0.3))).toEqual([])
        }
    )

    it.each(rates)('does not fire during a smooth 90 degree rotation at %i Hz', (rate) => {
        const samples = trace(rate, 4.5, (seconds) => {
            const angle = (Math.max(0, Math.min(1.5, seconds - 1)) / 1.5) * (Math.PI / 2)
            return [9.81 * Math.sin(angle), 0, 9.81 * Math.cos(angle)]
        })
        expect(fires(samples)).toEqual([])
    })

    it.each(rates)('does not fire during 10 seconds of noisy walking at %i Hz', (rate) => {
        const samples = trace(rate, 10, (seconds) => [0, 0, 9.81 + 3 * Math.sin(4 * Math.PI * seconds)], 0.3)
        expect(fires(samples)).toEqual([])
    })

    it.each(rates.flatMap((rate) => [1, 2].map((width) => ({ rate, width }))))(
        'does not fire for a $width sample table-set-down spike and small rebound at $rate Hz',
        ({ rate, width }) => {
            const samples = trace(rate, 4, (_, index) => {
                const offset = index - rate
                const acceleration = offset >= 0 && offset < width ? 12 : offset === width ? -3 : 0
                return [acceleration, 0, 9.81]
            })
            expect(fires(samples)).toEqual([])
        }
    )

    const vigorousCases = rates.flatMap((rate) =>
        axes.flatMap(({ name, axis }) =>
            [15, 20, 25].flatMap((amplitude) =>
                [3, 4.5, 6].map((frequency) => ({ rate, name, axis, amplitude, frequency }))
            )
        )
    )

    it.each(vigorousCases)(
        'fires exactly once for amplitude $amplitude at $frequency Hz on $name sampled at $rate Hz',
        ({ rate, axis, amplitude, frequency }) => {
            const shake = { start: 1, duration: 0.8, axis, amplitude, frequency }
            const samples = shakeTrace(rate, [shake])
            const events = fires(samples)
            expectInside(events, samples, [shake])
            expect(events.map((event) => event.mode)).toEqual(['vigorous'])
        }
    )

    it.each(rates.flatMap((rate) => axes.map((axis) => ({ rate, ...axis }))))(
        'fires exactly once for a moderate shake on $name at $rate Hz',
        ({ rate, axis }) => {
            const shake = { start: 1, duration: 1, axis, amplitude: 12, frequency: 3 }
            const samples = shakeTrace(rate, [shake])
            const events = fires(samples)
            expectInside(events, samples, [shake])
            expect(events.map((event) => event.mode)).toEqual(['vigorous'])
        }
    )

    it.each(rates.flatMap((rate) => [0.5, 3].map((separation) => ({ rate, separation }))))(
        'counts bouts with $separation seconds between onsets at $rate Hz',
        ({ rate, separation }) => {
            const first: Shake = { start: 1, duration: 0.4, axis: 0, amplitude: 25, frequency: 6 }
            const second = { ...first, start: first.start + separation }
            const samples = shakeTrace(rate, [first, second])
            expectInside(fires(samples), samples, separation === 3 ? [first, second] : [first])
        }
    )

    it.each(rates)('reset during cooldown allows the next smooth shake at %i Hz', (rate) => {
        const first: Shake = { start: 1, duration: 0.8, axis: 0, amplitude: 20, frequency: 4.5 }
        const second = { ...first, start: 2 }
        const samples = shakeTrace(rate, [first, second])
        const detector = createShakeDetector()
        const events: { index: number; t: number }[] = []
        let reset = false
        for (const [index, value] of samples.entries()) {
            if (!reset && value.t > (first.start + first.duration) * 1000) {
                expectInside(events, samples, [first])
                expect(value.t).toBeLessThan(events[0].t + 1500)
                detector.reset()
                reset = true
            }
            if (detector.push(value)) events.push({ index, t: value.t })
        }
        expect(reset).toBe(true)
        expectInside(events, samples, [first, second])
    })

    it.each(rates)('never fires for 200 seeded still-phone traces with noise below 2 at %i Hz', (rate) => {
        for (let seed = 1; seed <= 200; seed++) {
            const samples = trace(rate, 10, () => gravity, 1.99, seed)
            expect({ seed, rate, events: fires(samples) }).toEqual({ seed, rate, events: [] })
        }
    })
})

describe('all five motion modes at every supported sample rate', () => {
    const sources = ['OS linear', 'gravity fallback'] as const

    it.each(
        rates.flatMap((rate) =>
            sources.flatMap((source) =>
                [5, 6, 7].flatMap((amplitude) =>
                    [2, 2.5, 3].map((frequency) => ({ rate, source, amplitude, frequency }))
                )
            )
        )
    )('detects gentle $amplitude at $frequency Hz using $source sampled at $rate Hz', (value) => {
        const { rate, source, amplitude, frequency } = value
        const shake: Shake = { start: 1, duration: 2, axis: 0, amplitude, frequency }
        const fallback = shakeTrace(rate, [shake])
        const samples = source === 'OS linear' ? withLinear(fallback) : fallback
        const events = fires(samples)
        expectInside(events, samples, [shake])
        expect(events.map((event) => event.mode)).toEqual(['gentle'])
    })

    it.each(
        rates.flatMap((rate) =>
            (['alpha', 'beta', 'gamma'] as const).flatMap((axis) =>
                [false, true].map((noise) => ({ rate, axis, noise }))
            )
        )
    )('detects twist about $axis with linear noise $noise at $rate Hz', ({ rate, axis, noise }) => {
        const samples = trace(rate, 4, () => gravity, noise ? 0.3 : 0).map((value) => ({
            ...value,
            rotation: {
                alpha: 0,
                beta: 0,
                gamma: 0,
                [axis]: value.t >= 1000 && value.t <= 2000 ? 300 * Math.sin((6 * Math.PI * value.t) / 1000) : 0,
            },
        }))
        const events = fires(samples)
        expectInside(events, samples, [{ start: 1, duration: 1 }])
        expect(events.map((event) => event.mode)).toEqual(['twist'])
    })

    it.each(
        rates.flatMap((rate) =>
            [30, 35, 40].flatMap((amplitude) => [1, 2, 3].map((width) => ({ rate, amplitude, width })))
        )
    )('detects a $width sample OS bump of $amplitude at $rate Hz only on release', ({ rate, amplitude, width }) => {
        const samples = withLinear(
            trace(rate, 4, (_, index) => [index >= rate && index < rate + width ? amplitude : 0, 0, 9.81])
        )
        expect(fires(samples)).toEqual([{ index: rate + width, t: samples[rate + width].t, mode: 'bump' }])
    })

    it.each(rates)('detects a one sample 30-unit bump from gravity fallback at %i Hz', (rate) => {
        const samples = trace(rate, 4, (_, index) => [index === rate ? 30 : 0, 0, 9.81])
        expect(fires(samples)).toEqual([{ index: rate + 1, t: samples[rate + 1].t, mode: 'bump' }])
    })

    it.each(
        rates.flatMap((rate) => sources.flatMap((source) => [-1, 1].map((direction) => ({ rate, source, direction }))))
    )('reserves smooth $direction circular motion for circular using $source at $rate Hz', (value) => {
        const { rate, source, direction } = value
        const fallback = trace(rate, 4, (seconds) => {
            if (seconds < 1 || seconds > 2.2) return gravity
            const angle = direction * 3 * Math.PI * (seconds - 1)
            return [7 * Math.cos(angle), 7 * Math.sin(angle), 9.81]
        })
        const samples = source === 'OS linear' ? withLinear(fallback) : fallback
        const events = fires(samples)
        expectInside(events, samples, [{ start: 1, duration: 1.2 }])
        expect(events.map((event) => event.mode)).toEqual(['circular'])
        expect(events[0].t).toBeGreaterThanOrEqual(1950)
    })

    it.each(rates)('does not fire for walking while carrying the phone with gentle sway at %i Hz', (rate) => {
        const samples = trace(
            rate,
            10,
            (seconds) => [1.5 * Math.sin(Math.PI * seconds), 0, 9.81 + 3 * Math.sin(4 * Math.PI * seconds)],
            0.3
        )
        expect(fires(samples)).toEqual([])
        expect(fires(withLinear(samples))).toEqual([])
    })
})

describe('shake detector state and boundaries', () => {
    const createShakeDetector = createVigorousDetector
    it('publishes the accepted defaults', () => {
        expect(SHAKE_DETECTOR_DEFAULTS).toMatchObject({
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
        })
    })

    it('initializes gravity from the first accepted sample', () => {
        const detector = createShakeDetector({ minPeaks: 1 })
        expect(detector.push(sample(0, 100, -80, 50))).toBe(false)
        expect(detector.push(sample(100, 100, -80, 50))).toBe(false)
        expect(detector.push(sample(200, 130, -80, 50))).toBe(true)
    })

    it('counts alternating peaks rather than repeated high samples in one directional lobe', () => {
        const detector = createShakeDetector(stableGravity)
        const samples = [
            sample(0),
            sample(100, 20),
            sample(180, 25),
            sample(260, 30),
            sample(340, 20),
            sample(420, -20),
            sample(500, 20),
        ]
        expect(samples.map((value) => detector.push(value))).toEqual([false, false, false, false, false, false, true])
    })

    it('requires a negative vector dot product rather than an axis change', () => {
        const detector = createShakeDetector(stableGravity)
        const samples = [sample(0), sample(100, 20), sample(180, 15, 20), sample(260, -20), sample(340, 20)]
        expect(samples.map((value) => detector.push(value))).toEqual([false, false, false, false, true])
    })

    it('does not count an orthogonal finite vector when overflowing dot-product terms cancel', () => {
        const detector = createShakeDetector()
        const vectors: Vector[] = [
            [0, 0, 0],
            [1e308, 1e308, 0],
            [1e308, -1e308, 0],
            [-1e308, -1e308, 0],
            [1e308, 1e308, 0],
        ]
        const times = [0, 100, 180, 260, 340]
        const samples = vectors.map(([x, y, z], index) => ({
            ...sample(times[index]),
            linear: { x, y, z },
        }))
        expect(samples.map((value) => detector.push(value))).toEqual([false, false, false, false, true])
        expect(detector.lastMode()).toBe('vigorous')
    })

    it('accepts a reversal at the exact minimum peak gap and ignores earlier reversals', () => {
        const detector = createShakeDetector(stableGravity)
        const samples = [
            sample(0),
            sample(100, 20),
            sample(179, -20),
            sample(180, -20),
            sample(259, 20),
            sample(260, 20),
        ]
        expect(samples.map((value) => detector.push(value))).toEqual([false, false, false, false, false, true])
    })

    it.each([
        { lastT: 1100, expected: true },
        { lastT: 1100.001, expected: false },
    ])('expires peaks strictly older than the window at $lastT ms', ({ lastT, expected }) => {
        const detector = createShakeDetector(stableGravity)
        expect(detector.push(sample(0))).toBe(false)
        expect(detector.push(sample(100, 20))).toBe(false)
        expect(detector.push(sample(180, -20))).toBe(false)
        expect(detector.push(sample(lastT, 20))).toBe(expected)
    })

    it('clears expired history before starting a new peak sequence', () => {
        const detector = createShakeDetector(stableGravity)
        const samples = [
            sample(0),
            sample(100, 20),
            sample(180, -20),
            sample(1300, -20),
            sample(1380, 20),
            sample(1460, -20),
        ]
        expect(samples.map((value) => detector.push(value))).toEqual([false, false, false, false, false, true])
    })

    it('suppresses peaks through cooldown and resumes at the exact boundary', () => {
        const detector = createShakeDetector({ ...stableGravity, minPeaks: 1 })
        expect(detector.push(sample(0))).toBe(false)
        expect(detector.push(sample(100, 20))).toBe(true)
        expect(detector.push(sample(1599.999, -20))).toBe(false)
        expect(detector.push(sample(1600, -20))).toBe(true)
    })

    it('clears triggering peaks and does not accumulate peaks during cooldown', () => {
        const detector = createShakeDetector(stableGravity)
        const samples = [
            sample(0),
            sample(100, 20),
            sample(180, -20),
            sample(260, 20),
            sample(340, -20),
            sample(420, 20),
            sample(500, -20),
            sample(1759, 20),
            sample(1760, -20),
            sample(1840, 20),
            sample(1920, -20),
        ]
        expect(samples.map((value) => detector.push(value))).toEqual([
            false,
            false,
            false,
            true,
            false,
            false,
            false,
            false,
            false,
            false,
            true,
        ])
    })

    it('continues adapting gravity during cooldown', () => {
        const detector = createShakeDetector()
        for (const value of [sample(0), sample(100, 30), sample(180, -30)]) expect(detector.push(value)).toBe(false)
        expect(detector.push(sample(260, 30))).toBe(true)
        for (let t = 280; t < 1760; t += 20) expect(detector.push(sample(t, 30))).toBe(false)
        expect(detector.push(sample(1760, 30))).toBe(false)
        expect(detector.push(sample(1840, -20))).toBe(false)
        expect(detector.push(sample(1920, 60))).toBe(false)
        expect(detector.push(sample(2000, -20))).toBe(true)
    })

    it('clamps sub-millisecond integration intervals to 1 ms', () => {
        const detector = createShakeDetector({ gravityTauMs: 1, threshold: 2, minPeakGapMs: 0.2 })
        const samples = [sample(0), sample(0.25, 20), sample(0.5, 5), sample(0.75, 20)]
        expect(samples.map((value) => detector.push(value))).toEqual([false, false, false, true])
    })

    it('clamps long integration intervals to 200 ms', () => {
        const detector = createShakeDetector({ threshold: 2, minPeakGapMs: 1 })
        const samples = [
            sample(0),
            sample(1000, 20),
            sample(1001, 8),
            sample(1002, 20),
            sample(1003, 0),
            sample(1004, 20),
        ]
        expect(samples.map((value) => detector.push(value))).toEqual([false, false, false, false, false, true])
    })

    it.each(['partial peaks', 'cooldown'])('reset removes %s, gravity, and timestamp history', (phase) => {
        const detector = createShakeDetector()
        detector.push(sample(10000, 50, -20, 30))
        detector.push(sample(10100, 80, -20, 30))
        detector.push(sample(10180, 20, -20, 30))
        if (phase === 'cooldown') expect(detector.push(sample(10260, 80, -20, 30))).toBe(true)
        detector.reset()
        const fresh = createShakeDetector()
        const next = [sample(0), sample(100, 30), sample(180, -30), sample(260, 30)]
        const expected = next.map((value) => fresh.push(value))
        expect(expected).toEqual([false, false, false, true])
        expect(next.map((value) => detector.push(value))).toEqual(expected)
    })
})

describe('shake detector rejects invalid samples without changing any state', () => {
    const createShakeDetector = createVigorousDetector
    const invalidValues = [
        { label: 'null', value: null },
        { label: 'NaN', value: Number.NaN },
        { label: '+Infinity', value: Number.POSITIVE_INFINITY },
        { label: '-Infinity', value: Number.NEGATIVE_INFINITY },
    ]
    const invalidSamples = (['x', 'y', 'z', 't'] as const).flatMap((field) =>
        invalidValues.map(({ label, value }) => ({
            name: `${field} ${label}`,
            make: (_lastT: number): MotionSample =>
                ({ ...sample(1e6, 1e15, -1e15, 1e15), [field]: value }) as MotionSample,
        }))
    )
    const replayedSamples = [0, -1, -100].map((offset) => ({
        name: `timestamp offset ${offset}`,
        make: (lastT: number): MotionSample => sample(lastT + offset, 1e15, -1e15, 1e15),
    }))

    it.each(
        ['partial peaks', 'cooldown'].flatMap((phase) =>
            [...invalidSamples, ...replayedSamples].map((invalid) => ({ phase, ...invalid }))
        )
    )('ignores $name during $phase without throwing or altering subsequent output', ({ phase, make }) => {
        const baseline = createShakeDetector(stableGravity)
        const actual = createShakeDetector(stableGravity)
        const all = [
            sample(0),
            sample(100, 20),
            sample(180, -20),
            sample(260, 20),
            sample(500, -20),
            sample(1760, -20),
            sample(1840, 20),
            sample(1920, -20),
        ]
        const split = phase === 'partial peaks' ? 2 : 4
        for (const value of all.slice(0, split)) expect(actual.push(value)).toBe(baseline.push(value))
        let invalidResult: boolean | undefined
        expect(() => {
            invalidResult = actual.push(make(all[split - 1].t))
        }).not.toThrow()
        expect(invalidResult).toBe(false)
        const expected = all.slice(split).map((value) => baseline.push(value))
        expect(expected.filter(Boolean)).toHaveLength(phase === 'partial peaks' ? 2 : 1)
        expect(all.slice(split).map((value) => actual.push(value))).toEqual(expected)
    })

    it('does not initialize gravity or timestamp history from an invalid first sample', () => {
        const detector = createShakeDetector({ minPeaks: 1 })
        expect(detector.push({ ...sample(1e6, 1e15), y: null })).toBe(false)
        expect(detector.push(sample(0, 20))).toBe(false)
        expect(detector.push(sample(100, 20))).toBe(false)
        expect(detector.push(sample(200, -20))).toBe(true)
    })
})

describe('all shake detector options are behaviorally overrideable', () => {
    const fires = vigorousFires

    it.each(rates)('raising vigorous threshold suppresses a moderate vigorous shake at %i Hz', (rate) => {
        const shake: Shake = { start: 1, duration: 1, axis: 0, amplitude: 12, frequency: 3 }
        const samples = shakeTrace(rate, [shake])
        expectInside(fires(samples), samples, [shake])
        expect(fires(samples, { threshold: 100 })).toEqual([])
    })

    it('allows a different minimum peak count', () => {
        const samples = [sample(0), sample(100, 20), sample(180, -20), sample(260, 20), sample(340, -20)]
        expect(fires(samples, stableGravity).map((event) => event.index)).toEqual([3])
        expect(fires(samples, { ...stableGravity, minPeaks: 4 }).map((event) => event.index)).toEqual([4])
    })

    it('allows a shorter peak window', () => {
        const samples = [sample(0), sample(100, 20), sample(250, -20), sample(340, 20), sample(420, -20)]
        expect(fires(samples, stableGravity).map((event) => event.index)).toEqual([3])
        expect(fires(samples, { ...stableGravity, windowMs: 200 }).map((event) => event.index)).toEqual([4])
    })

    it('allows a shorter cooldown', () => {
        const samples = [
            sample(0),
            sample(100, 20),
            sample(180, -20),
            sample(260, 20),
            sample(500, -20),
            sample(580, 20),
            sample(660, -20),
        ]
        expect(fires(samples, stableGravity).map((event) => event.index)).toEqual([3])
        expect(fires(samples, { ...stableGravity, cooldownMs: 200 }).map((event) => event.index)).toEqual([3, 6])
    })

    it('allows zero cooldown', () => {
        const samples = [sample(0), sample(100, 20), sample(101, -20), sample(102, 20)]
        const options = { ...stableGravity, minPeaks: 1, cooldownMs: 0 }
        expect(fires(samples, options).map((event) => event.index)).toEqual([1, 2, 3])
    })

    it('allows a shorter minimum peak gap', () => {
        const samples = [sample(0), sample(100, 20), sample(140, -20), sample(180, 20)]
        expect(fires(samples, stableGravity)).toEqual([])
        expect(fires(samples, { ...stableGravity, minPeakGapMs: 40 }).map((event) => event.index)).toEqual([3])
    })

    it('allows a different gravity time constant', () => {
        const samples = [sample(0), sample(100, 20), sample(101, 10), sample(102, 20)]
        const options = { threshold: 1, minPeakGapMs: 1 }
        expect(fires(samples, options)).toEqual([])
        expect(fires(samples, { ...options, gravityTauMs: 10 }).map((event) => event.index)).toEqual([3])
    })
})

describe('multimode sensor and shared state contracts', () => {
    const linear = (t: number, x: number, y = 0): MotionSample => ({
        t,
        x: null,
        y: null,
        z: null,
        linear: { x, y, z: 0 },
    })
    const rotation = (t: number, alpha: number): MotionSample => ({
        t,
        x: null,
        y: null,
        z: null,
        rotation: { alpha, beta: 0, gamma: 0 },
    })

    it('retains lastMode through quiet and ignored samples and clears it on reset', () => {
        const detector = createShakeDetector()
        expect(detector.lastMode()).toBeNull()
        for (const value of [linear(0, 0), linear(100, 30)]) expect(detector.push(value)).toBe(false)
        expect(detector.push(linear(150, 0))).toBe(true)
        expect(detector.lastMode()).toBe('bump')
        for (const value of [linear(200, 0), sample(1e6, NaN), rotation(199, 300)]) {
            expect(detector.push(value)).toBe(false)
            expect(detector.lastMode()).toBe('bump')
        }
        detector.reset()
        expect(detector.lastMode()).toBeNull()
        expect(detector.push(rotation(0, 300))).toBe(false)
        expect(detector.push(rotation(100, -300))).toBe(false)
        expect(detector.push(rotation(200, 300))).toBe(true)
        expect(detector.lastMode()).toBe('twist')
    })

    it('uses valid OS linear acceleration in preference to conflicting gravity measurements', () => {
        const samples = [0, 100, 200, 300, 400, 500, 600].map((t, index) => ({
            ...sample(t, index % 2 ? 40 : -40),
            linear: { x: 0, y: 0, z: 0 },
        }))
        expect(fires(samples)).toEqual([])
        const active = samples.map((value, index) => ({
            ...sample(value.t),
            linear: { x: index === 0 ? 0 : index % 2 ? 20 : -20, y: 0, z: 0 },
        }))
        expect(fires(active).map((event) => event.mode)).toEqual(['vigorous'])
    })

    it.each([null, undefined, { x: null, y: 0, z: 0 }, { x: 0, y: NaN, z: 0 }, { x: 0, y: 0, z: Infinity }])(
        'falls back safely when optional linear acceleration is %p',
        (invalid) => {
            const samples = shakeTrace(60, [{ start: 1, duration: 0.8, axis: 0, amplitude: 20, frequency: 4.5 }])
            const actual = samples.map((value) => ({ ...value, linear: invalid }))
            expect(fires(actual)).toEqual(fires(samples))
        }
    )

    it.each([null, undefined, { alpha: null, beta: 0, gamma: 0 }, { alpha: 0, beta: NaN, gamma: Infinity }])(
        'invalid optional rotation %p never blocks valid linear motion',
        (invalid) => {
            const samples = [linear(0, 0), linear(100, 30), linear(150, 0)]
            expect(fires(samples.map((value) => ({ ...value, rotation: invalid })))).toEqual(fires(samples))
        }
    )

    it('shares the timestamp guard across linear-only and rotation-only sensors', () => {
        const detector = createShakeDetector()
        expect(detector.push(rotation(100, 300))).toBe(false)
        expect(detector.push(linear(100, 30))).toBe(false)
        expect(detector.push(rotation(200, -300))).toBe(false)
        expect(detector.push(linear(199, 30))).toBe(false)
        expect(detector.push(rotation(300, 300))).toBe(true)
        expect(detector.lastMode()).toBe('twist')
    })

    it('integrates gravity from the last gravity sample even across rotation-only samples', () => {
        const detector = createVigorousDetector({ minPeaks: 1, threshold: 15 })
        expect(detector.push(sample(0))).toBe(false)
        expect(detector.push(rotation(999, 0))).toBe(false)
        expect(detector.push(sample(1000, 20))).toBe(false)
        expect(detector.push(sample(1100, -20))).toBe(true)
    })

    it.each([NaN, Infinity, -Infinity, 100, 99])('ignores invalid or replayed time %p with valid sensors', (t) => {
        const detector = createShakeDetector()
        expect(detector.push(rotation(0, 300))).toBe(false)
        expect(detector.push(rotation(100, -300))).toBe(false)
        expect(detector.push({ ...linear(t, 30), rotation: { alpha: 300, beta: 0, gamma: 0 } })).toBe(false)
        expect(detector.push(rotation(200, 300))).toBe(true)
        expect(detector.lastMode()).toBe('twist')
    })

    it('fires once and starts shared cooldown when linear and twist modes qualify on one sample', () => {
        const samples = [0, 100, 200, 300, 400, 500].map((t, index) => ({
            ...linear(t, index === 0 ? 0 : index % 2 ? 20 : -20),
            rotation: { alpha: index === 0 ? 0 : index % 2 ? 300 : -300, beta: 0, gamma: 0 },
        }))
        const events = fires(samples)
        expect(events).toHaveLength(1)
        expect(events[0].t).toBe(300)
        expect(['vigorous', 'twist']).toContain(events[0].mode)
    })

    it.each([
        { mode: 'vigorous', magnitude: 20, count: 3 },
        { mode: 'gentle', magnitude: 6, count: 5 },
    ])('clears partial $mode history when twist fires', ({ mode, magnitude, count }) => {
        const detector = createShakeDetector({ cooldownMs: 0 })
        expect(detector.push(linear(0, 0))).toBe(false)
        for (let index = 0; index < count - 1; index++) {
            expect(detector.push(linear(100 + index * 120, index % 2 ? -magnitude : magnitude))).toBe(false)
        }
        expect(detector.push(rotation(600, 300))).toBe(false)
        expect(detector.push(rotation(700, -300))).toBe(false)
        expect(detector.push(rotation(800, 300))).toBe(true)
        expect(detector.lastMode()).toBe('twist')
        for (let index = 0; index < count; index++) {
            expect(detector.push(linear(900 + index * 120, index % 2 ? magnitude : -magnitude))).toBe(
                index === count - 1
            )
        }
        expect(detector.lastMode()).toBe(mode)
    })

    it('clears a pending bump when a different mode fires', () => {
        const detector = createShakeDetector({ cooldownMs: 0 })
        expect(detector.push(rotation(0, 300))).toBe(false)
        expect(detector.push(rotation(100, -300))).toBe(false)
        expect(detector.push(linear(150, 30))).toBe(false)
        expect(detector.push(rotation(200, 300))).toBe(true)
        expect(detector.push(linear(250, 0))).toBe(false)
        expect(detector.lastMode()).toBe('twist')
    })

    it('clears partial twist history when bump fires', () => {
        const detector = createShakeDetector({ cooldownMs: 0 })
        for (const value of [rotation(100, 300), rotation(200, -300), linear(250, 30)]) {
            expect(detector.push(value)).toBe(false)
        }
        expect(detector.push(linear(300, 0))).toBe(true)
        expect(detector.lastMode()).toBe('bump')
        expect(detector.push(rotation(400, 300))).toBe(false)
        expect(detector.push(rotation(500, -300))).toBe(false)
        expect(detector.push(rotation(600, 300))).toBe(true)
    })

    it('clears accumulated circular angle when twist fires', () => {
        const detector = createShakeDetector({ cooldownMs: 0 })
        for (let index = 0; index <= 8; index++) {
            const angle = (index * Math.PI) / 4
            expect(detector.push(linear(index * 100, 7 * Math.cos(angle), 7 * Math.sin(angle)))).toBe(false)
        }
        expect(detector.push(rotation(850, 300))).toBe(false)
        expect(detector.push(rotation(950, -300))).toBe(false)
        expect(detector.push(rotation(1050, 300))).toBe(true)
        for (let index = 1; index <= 5; index++) {
            const angle = (index * Math.PI) / 4
            expect(detector.push(linear(1000 + index * 100, 7 * Math.cos(angle), 7 * Math.sin(angle)))).toBe(false)
        }
        expect(detector.lastMode()).toBe('twist')
    })

    it('shared cooldown suppresses other modes without carrying their partial histories forward', () => {
        const detector = createShakeDetector()
        expect(detector.push(linear(0, 0))).toBe(false)
        expect(detector.push(linear(100, 30))).toBe(false)
        expect(detector.push(linear(150, 0))).toBe(true)
        for (const value of [rotation(1400, 300), rotation(1500, -300), rotation(1600, 300)]) {
            expect(detector.push(value)).toBe(false)
        }
        expect(detector.push(rotation(1650, -300))).toBe(false)
        expect(detector.push(rotation(1750, 300))).toBe(false)
        expect(detector.push(rotation(1850, -300))).toBe(true)
        expect(detector.lastMode()).toBe('twist')
    })

    it('raising the vigorous threshold leaves gentle detection active', () => {
        const samples = shakeTrace(60, [{ start: 1, duration: 1, axis: 0, amplitude: 12, frequency: 3 }])
        expect(fires(samples, { threshold: 100 }).map((event) => event.mode)).toEqual(['gentle'])
    })
})

describe('motion sensor availability probe', () => {
    const emptyVector = { x: null, y: null, z: null }
    const emptyRotation = { alpha: null, beta: null, gamma: null }
    let originalDeviceMotion: PropertyDescriptor | undefined

    const emit = (fields: Record<string, unknown>) => {
        const event = new Event('devicemotion')
        Object.defineProperties(
            event,
            Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, { value, configurable: true }]))
        )
        window.dispatchEvent(event)
    }

    beforeEach(() => {
        jest.useFakeTimers()
        originalDeviceMotion = Object.getOwnPropertyDescriptor(window, 'DeviceMotionEvent')
        Object.defineProperty(window, 'DeviceMotionEvent', { configurable: true, value: class {} })
    })

    afterEach(() => {
        if (originalDeviceMotion) Object.defineProperty(window, 'DeviceMotionEvent', originalDeviceMotion)
        else Reflect.deleteProperty(window, 'DeviceMotionEvent')
        jest.useRealTimers()
    })

    it.each([
        { field: 'accelerationIncludingGravity', vector: { x: 0, y: 0, z: 9.81 } },
        { field: 'acceleration', vector: { x: 0, y: 0, z: 0 } },
        { field: 'rotationRate', vector: { alpha: 0, beta: 0, gamma: 0 } },
    ])('treats finite $field as an available sensor', ({ field, vector }) => {
        const { result, unmount } = renderHook(() => useShakeMotion({ onShake: jest.fn() }))
        expect(result.current.status).toBe('listening')
        act(() => {
            emit({
                accelerationIncludingGravity: emptyVector,
                acceleration: emptyVector,
                rotationRate: emptyRotation,
                [field]: vector,
                timeStamp: 100,
            })
            jest.advanceTimersByTime(1500)
        })
        expect(result.current.status).toBe('listening')
        unmount()
    })

    it.each([
        { accelerationIncludingGravity: emptyVector, acceleration: emptyVector, rotationRate: emptyRotation },
        { accelerationIncludingGravity: null, acceleration: null, rotationRate: null },
        {
            accelerationIncludingGravity: { x: Infinity, y: 0, z: 0 },
            acceleration: { x: 0, y: NaN, z: 0 },
            rotationRate: { alpha: 0, beta: 0, gamma: Infinity },
        },
    ])('marks the probe unsupported when no complete finite vector arrives: %p', (fields) => {
        const { result, unmount } = renderHook(() => useShakeMotion({ onShake: jest.fn() }))
        act(() => {
            emit({ ...fields, timeStamp: 100 })
            jest.advanceTimersByTime(1500)
        })
        expect(result.current.status).toBe('unsupported')
        unmount()
    })

    it.each(['linear', 'rotation'])(
        'forwards %s-only events to the real detector without requiring gravity',
        (sensor) => {
            const onShake = jest.fn()
            const { unmount } = renderHook(() => useShakeMotion({ onShake }))
            act(() => {
                const values = sensor === 'linear' ? [0, 30, 0] : [0, 300, -300, 300]
                values.forEach((value, index) => {
                    emit({
                        accelerationIncludingGravity: null,
                        acceleration: sensor === 'linear' ? { x: value, y: 0, z: 0 } : null,
                        rotationRate: sensor === 'rotation' ? { alpha: value, beta: 0, gamma: 0 } : null,
                        timeStamp: index * 100,
                    })
                })
            })
            expect(onShake).toHaveBeenCalledTimes(1)
            unmount()
        }
    )

    it('reports unsupported when DeviceMotionEvent is unavailable', () => {
        Reflect.deleteProperty(window, 'DeviceMotionEvent')
        const { result, unmount } = renderHook(() => useShakeMotion({ onShake: jest.fn() }))
        expect(result.current.status).toBe('unsupported')
        unmount()
    })

    it('requests permission only after explicit user action and listens after a grant', async () => {
        const requestPermission = jest.fn().mockResolvedValue('granted')
        Object.defineProperty(window, 'DeviceMotionEvent', {
            configurable: true,
            value: Object.assign(class {}, { requestPermission }),
        })
        const onShake = jest.fn()
        const { result, unmount } = renderHook(() => useShakeMotion({ onShake }))
        expect(result.current.status).toBe('needs-permission')
        act(() => {
            jest.advanceTimersByTime(2000)
            for (const [index, x] of [0, 30, 0].entries()) {
                emit({ acceleration: { x, y: 0, z: 0 }, timeStamp: index * 100 })
            }
        })
        expect(requestPermission).not.toHaveBeenCalled()
        expect(onShake).not.toHaveBeenCalled()
        expect(result.current.status).toBe('needs-permission')

        await act(async () => {
            await result.current.requestPermission()
        })
        expect(requestPermission).toHaveBeenCalledTimes(1)
        expect(result.current.status).toBe('listening')
        act(() => {
            for (const [index, x] of [0, 30, 0].entries()) {
                emit({ acceleration: { x, y: 0, z: 0 }, timeStamp: 300 + index * 100 })
            }
        })
        expect(onShake).toHaveBeenCalledTimes(1)
        unmount()
    })

    it.each(['denied', 'default', 'reject'])('reports denied when the permission result is %s', async (response) => {
        const requestPermission = jest.fn()
        if (response === 'reject') requestPermission.mockRejectedValue(new Error('Permission unavailable'))
        else requestPermission.mockResolvedValue(response)
        Object.defineProperty(window, 'DeviceMotionEvent', {
            configurable: true,
            value: Object.assign(class {}, { requestPermission }),
        })
        const onShake = jest.fn()
        const { result, unmount } = renderHook(() => useShakeMotion({ onShake }))
        expect(result.current.status).toBe('needs-permission')
        expect(requestPermission).not.toHaveBeenCalled()
        await act(async () => {
            await result.current.requestPermission()
        })
        expect(requestPermission).toHaveBeenCalledTimes(1)
        expect(result.current.status).toBe('denied')
        act(() => {
            for (const [index, x] of [0, 30, 0].entries()) {
                emit({ acceleration: { x, y: 0, z: 0 }, timeStamp: index * 100 })
            }
            jest.advanceTimersByTime(1500)
        })
        expect(onShake).not.toHaveBeenCalled()
        expect(result.current.status).toBe('denied')
        unmount()
    })

    it('resets pending motion when hidden and accepts a fresh gesture after becoming visible', () => {
        const originalHidden = Object.getOwnPropertyDescriptor(document, 'hidden')
        const originalVisibility = Object.getOwnPropertyDescriptor(document, 'visibilityState')
        const setVisibility = (hidden: boolean) => {
            Object.defineProperty(document, 'hidden', { configurable: true, value: hidden })
            Object.defineProperty(document, 'visibilityState', {
                configurable: true,
                value: hidden ? 'hidden' : 'visible',
            })
            document.dispatchEvent(new Event('visibilitychange'))
        }
        setVisibility(false)
        const onShake = jest.fn()
        const { unmount } = renderHook(() => useShakeMotion({ onShake }))
        try {
            act(() => {
                emit({ acceleration: { x: 0, y: 0, z: 0 }, timeStamp: 0 })
                emit({ acceleration: { x: 30, y: 0, z: 0 }, timeStamp: 100 })
                setVisibility(true)
                setVisibility(false)
                emit({ acceleration: { x: 0, y: 0, z: 0 }, timeStamp: 150 })
            })
            expect(onShake).not.toHaveBeenCalled()
            act(() => {
                emit({ acceleration: { x: 30, y: 0, z: 0 }, timeStamp: 200 })
                emit({ acceleration: { x: 0, y: 0, z: 0 }, timeStamp: 250 })
            })
            expect(onShake).toHaveBeenCalledTimes(1)
        } finally {
            unmount()
            if (originalHidden) Object.defineProperty(document, 'hidden', originalHidden)
            else Reflect.deleteProperty(document, 'hidden')
            if (originalVisibility) Object.defineProperty(document, 'visibilityState', originalVisibility)
            else Reflect.deleteProperty(document, 'visibilityState')
        }
    })

    it('cleans up the sensor probe and motion listener when unmounted', () => {
        const timerCount = jest.getTimerCount()
        const onShake = jest.fn()
        const { result, unmount } = renderHook(() => useShakeMotion({ onShake }))
        expect(result.current.status).toBe('listening')
        unmount()
        expect(jest.getTimerCount()).toBe(timerCount)
        act(() => {
            jest.advanceTimersByTime(1500)
            for (const [index, x] of [0, 30, 0].entries()) {
                emit({ acceleration: { x, y: 0, z: 0 }, timeStamp: index * 100 })
            }
        })
        expect(onShake).not.toHaveBeenCalled()
    })
})

describe('circular continuity and direction protections', () => {
    const circularOnly: ShakeDetectorOptions = {
        threshold: Infinity,
        gentle: { threshold: Infinity },
        twist: { threshold: Infinity },
        bump: { threshold: Infinity },
    }
    const vector = (angle: number): Vector => [7 * Math.cos(angle), 7 * Math.sin(angle), 9.81]

    it.each([
        { endT: 1000, expected: true },
        { endT: 1000.001, expected: false },
    ])('counts only complete angular intervals inside the window ending at $endT ms', ({ endT, expected }) => {
        const samples = withLinear(
            Array.from({ length: 9 }, (_, index) => {
                const [x, y, z] = vector((index * Math.PI) / 4)
                return sample(index === 8 ? endT : index * 125, x, y, z)
            })
        )
        const events = fires(samples, { ...circularOnly, circular: { minDegrees: 360, windowMs: 1000 } })
        expect(events).toEqual(expected ? [{ index: 8, t: endT, mode: 'circular' }] : [])
    })

    const cases: { name: string; duration: number; acceleration: (seconds: number) => Vector }[] = [
        {
            name: 'one complete revolution below the required 540 degrees',
            duration: 3,
            acceleration: (seconds) => {
                const elapsed = seconds - 1
                return elapsed >= 0 && elapsed <= 2 / 3 ? vector(3 * Math.PI * elapsed) : gravity
            },
        },
        {
            name: 'slow rotation that cannot complete 540 degrees inside the window',
            duration: 5,
            acceleration: (seconds) => {
                const elapsed = seconds - 1
                return elapsed >= 0 && elapsed <= 3 ? vector(Math.PI * elapsed) : gravity
            },
        },
        {
            name: 'smooth forward then reverse movement with 720 degrees of total travel but no 540 degree turn',
            duration: 4,
            acceleration: (seconds) => {
                const elapsed = seconds - 1
                return elapsed >= 0 && elapsed <= 1.2
                    ? vector(2 * Math.PI * Math.sin((Math.PI * elapsed) / 1.2))
                    : gravity
            },
        },
        {
            name: 'two incomplete circular bursts separated by 500 ms without qualifying movement',
            duration: 4,
            acceleration: (seconds) => {
                const elapsed = seconds - 1
                if (elapsed >= 0 && elapsed <= 0.6) return vector((2 * Math.PI * elapsed) / 0.6)
                if (elapsed >= 1.1 && elapsed <= 1.7) return vector((2 * Math.PI * (elapsed - 1.1)) / 0.6)
                return gravity
            },
        },
        {
            name: 'abrupt 180 degree flips exceeding the maximum smooth step',
            duration: 4,
            acceleration: (seconds) => {
                const elapsed = seconds - 1
                return elapsed >= 0 && elapsed <= 1.5 ? vector(Math.floor(elapsed * 5) * Math.PI) : gravity
            },
        },
    ]

    it.each(rates.flatMap((rate) => cases.map((scenario) => ({ rate, ...scenario }))))(
        'does not report circular for $name at $rate Hz',
        ({ rate, duration, acceleration }) => {
            const samples = withLinear(trace(rate, duration, acceleration))
            expect(fires(samples, circularOnly)).toEqual([])
        }
    )
})

describe('mode-specific options and boundaries', () => {
    const linear = (t: number, x: number, y = 0): MotionSample => ({ ...sample(t), linear: { x, y, z: 0 } })
    const rotation = (t: number, alpha: number): MotionSample => ({
        ...sample(t),
        rotation: { alpha, beta: 0, gamma: 0 },
    })

    it('does not detect a bump when a sustained 30-unit plateau outlasts the release deadline', () => {
        const samples = [
            linear(0, 0),
            ...Array.from({ length: 6 }, (_, index) => linear(100 + index * 50, 30)),
            linear(400, 0),
            linear(500, 0),
        ]
        expect(fires(samples)).toEqual([])
    })

    it.each([
        { options: { threshold: 7 }, expected: [] },
        { options: { minPeaks: 3 }, expected: [340] },
        { options: { windowMs: 400 }, expected: [] },
        { options: { minPeakGapMs: 150 }, expected: [] },
    ])('honors gentle options $options', ({ options, expected }) => {
        const samples = [linear(0, 0), ...[6, -6, 6, -6, 6].map((x, index) => linear(100 + index * 120, x))]
        expect(fires(samples).map((event) => event.t)).toEqual([580])
        expect(fires(samples, { gentle: options }).map((event) => event.t)).toEqual(expected)
    })

    it.each([
        { options: { threshold: 350 }, expected: [] },
        { options: { minPeaks: 2 }, expected: [200] },
        { options: { windowMs: 150 }, expected: [] },
        { options: { minPeakGapMs: 150 }, expected: [] },
    ])('honors twist options $options', ({ options, expected }) => {
        const samples = [rotation(0, 0), rotation(100, 300), rotation(200, -300), rotation(300, 300)]
        expect(fires(samples).map((event) => event.t)).toEqual([300])
        expect(fires(samples, { twist: options }).map((event) => event.t)).toEqual(expected)
    })

    it.each([
        { options: { threshold: 35 }, expected: [] },
        { options: { releaseThreshold: 4 }, expected: [220] },
        { options: { maxDurationMs: 80 }, expected: [] },
    ])('honors bump options $options', ({ options, expected }) => {
        const samples = [linear(0, 0), linear(100, 30), linear(200, 5), linear(220, 0)]
        expect(fires(samples).map((event) => event.t)).toEqual([200])
        expect(fires(samples, { bump: options }).map((event) => event.t)).toEqual(expected)
    })

    it.each([
        { releaseT: 250, expected: true },
        { releaseT: 250.001, expected: false },
    ])('bump release deadline is inclusive at $releaseT ms', ({ releaseT, expected }) => {
        const detector = createShakeDetector()
        expect(detector.push(linear(0, 0))).toBe(false)
        expect(detector.push(linear(100, 25))).toBe(false)
        expect(detector.push(linear(200, 8))).toBe(false)
        expect(detector.push(linear(releaseT, 7.99))).toBe(expected)
    })

    it.each([
        { options: { threshold: 8 }, expected: [] },
        { options: { minDegrees: 360 }, expected: [900] },
        { options: { windowMs: 1000 }, expected: [] },
        { options: { maxStepDegrees: 30 }, expected: [] },
    ])('honors circular options $options', ({ options, expected }) => {
        const samples = [
            linear(0, 0),
            ...Array.from({ length: 13 }, (_, index) => {
                const angle = (index * Math.PI) / 4
                return linear(100 + index * 100, 7 * Math.cos(angle), 7 * Math.sin(angle))
            }),
        ]
        expect(fires(samples).map((event) => event.t)).toEqual([1300])
        expect(
            fires(samples, { ...onlyVigorousOptions, threshold: Infinity, circular: options }).map((event) => event.t)
        ).toEqual(expected)
    })
})

// FOLLOWUP2: public mode selection is independent of threshold configuration.
describe('explicit motion mode selection', () => {
    const restricted: ShakeMode[] = ['vigorous', 'twist']
    const modes: ShakeMode[] = ['vigorous', 'gentle', 'twist', 'bump', 'circular']

    function modeSamples(mode: ShakeMode, rate: number): MotionSample[] {
        if (mode === 'vigorous' || mode === 'gentle') {
            return withLinear(
                shakeTrace(rate, [
                    {
                        start: 1,
                        duration: mode === 'vigorous' ? 0.8 : 2,
                        amplitude: mode === 'vigorous' ? 20 : 6,
                        frequency: mode === 'vigorous' ? 4.5 : 2.5,
                        axis: 0,
                    },
                ])
            )
        }
        if (mode === 'twist') {
            return trace(rate, 4, () => gravity).map((value) => ({
                ...value,
                rotation: {
                    alpha: value.t >= 1000 && value.t <= 2000 ? 300 * Math.sin((6 * Math.PI * value.t) / 1000) : 0,
                    beta: 0,
                    gamma: 0,
                },
            }))
        }
        if (mode === 'bump') {
            return withLinear(trace(rate, 4, (_, index) => [index === rate ? 30 : 0, 0, 9.81]))
        }
        return withLinear(
            trace(rate, 4, (seconds) => {
                if (seconds < 1 || seconds > 2.2) return gravity
                const angle = 3 * Math.PI * (seconds - 1)
                return [7 * Math.cos(angle), 7 * Math.sin(angle), 9.81]
            })
        )
    }

    it.each(rates)('excludes ordinary gentle motion at %i Hz for Home modes', (rate) => {
        expect(fires(modeSamples('gentle', rate), { modes: restricted })).toEqual([])
    })

    it.each(rates.flatMap((rate) => (['vigorous', 'twist'] as const).map((mode) => ({ rate, mode }))))(
        'retains $mode at $rate Hz for Home modes',
        ({ rate, mode }) => {
            expect(fires(modeSamples(mode, rate), { modes: restricted }).map((event) => event.mode)).toEqual([mode])
        }
    )

    it.each(rates.flatMap((rate) => modes.map((mode) => ({ rate, mode }))))(
        'retains default $mode at $rate Hz when modes is omitted',
        ({ rate, mode }) => {
            expect(fires(modeSamples(mode, rate)).map((event) => event.mode)).toEqual([mode])
        }
    )

    it.each(rates.flatMap((rate) => modes.map((mode) => ({ rate, mode }))))(
        'allows singleton $mode at $rate Hz',
        ({ rate, mode }) => {
            expect(fires(modeSamples(mode, rate), { modes: [mode] }).map((event) => event.mode)).toEqual([mode])
        }
    )

    it.each(rates.flatMap((rate) => modes.map((mode) => ({ rate, mode }))))(
        'empty modes disables $mode at $rate Hz',
        ({ rate, mode }) => {
            const detector = createShakeDetector({ modes: [] })
            for (const value of modeSamples(mode, rate)) expect(detector.push(value)).toBe(false)
            expect(detector.lastMode()).toBeNull()
        }
    )

    const exclusiveCases = modes.flatMap((enabled) =>
        modes
            .filter(
                (disabled) =>
                    disabled !== enabled && !(enabled === 'gentle' && ['vigorous', 'circular'].includes(disabled))
            )
            .map((disabled) => ({ enabled, disabled }))
    )
    it.each(exclusiveCases)(
        'singleton $enabled ignores a $disabled gesture that cannot satisfy it',
        ({ enabled, disabled }) => {
            expect(fires(modeSamples(disabled, 60), { modes: [enabled] })).toEqual([])
        }
    )

    it.each(rates)('does not reserve circular motion when circular is disabled at %i Hz', (rate) => {
        const samples = withLinear(
            trace(rate, 2.4, (seconds) => {
                if (seconds < 1 || seconds > 2.2) return gravity
                const angle = 3 * Math.PI * (seconds - 1)
                return [20 * Math.cos(angle), 20 * Math.sin(angle), 9.81]
            })
        )
        expect(fires(samples, { modes: ['vigorous'] }).map((event) => event.mode)).toEqual(['vigorous'])
    })

    it('shares cooldown between the enabled modes and resets its last reported mode', () => {
        const detector = createShakeDetector({ modes: restricted })
        const linear = (t: number, x: number): MotionSample => ({ ...sample(t), linear: { x, y: 0, z: 0 } })
        const rotation = (t: number, alpha: number): MotionSample => ({
            ...sample(t),
            rotation: { alpha, beta: 0, gamma: 0 },
        })
        expect(detector.push(linear(0, 0))).toBe(false)
        expect(detector.push(linear(100, 20))).toBe(false)
        expect(detector.push(linear(200, -20))).toBe(false)
        expect(detector.push(linear(300, 20))).toBe(true)
        expect(detector.lastMode()).toBe('vigorous')
        for (const value of [rotation(400, 300), rotation(500, -300), rotation(600, 300)]) {
            expect(detector.push(value)).toBe(false)
        }
        detector.reset()
        expect(detector.lastMode()).toBeNull()
        expect(detector.push(rotation(0, 300))).toBe(false)
        expect(detector.push(rotation(100, -300))).toBe(false)
        expect(detector.push(rotation(200, 300))).toBe(true)
        expect(detector.lastMode()).toBe('twist')
    })
})
