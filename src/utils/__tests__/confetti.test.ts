jest.mock('@/utils/native-platform', () => require('@/test-utils/native-platform-mock').createNativePlatformMock())

/**
 * Confetti has broken twice with nothing covering it: once by being suppressed
 * outright under prefers-reduced-motion, once by wedging permanently after a
 * single failure on a document that never reloads. Both are asserted here.
 */
const fire = jest.fn().mockResolvedValue(undefined)
const create = jest.fn(() => fire)

jest.mock('canvas-confetti', () => ({ __esModule: true, default: { create } }))

// jsdom cannot load an image or draw a canvas, so the star shapes are stubbed.
const starShape = (height: number) => ({ type: 'bitmap', bitmap: `star-${height}`, matrix: [1, 0, 0, 1, 0, 0] })
const mockLoadStarShapes = jest.fn((heights: readonly number[]) => Promise.resolve(heights.map(starShape)))
jest.mock('@/utils/confetti-star-shapes', () => ({
    loadStarShapes: (heights: readonly number[]) => mockLoadStarShapes(heights),
}))

const mockIsCapacitor = jest.fn().mockReturnValue(false)
jest.mock('@/utils/capacitor', () => ({ isCapacitor: () => mockIsCapacitor() }))

function setReducedMotion(reduced: boolean) {
    Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: (query: string) => ({
            matches: reduced && query.includes('prefers-reduced-motion'),
            media: query,
            addEventListener: () => {},
            removeEventListener: () => {},
        }),
    })
}

/** Each test re-imports so the memoized instance and the burst throttle reset. */
async function loadConfetti() {
    return import('@/utils/confetti')
}

/** getConfetti() goes through a dynamic import, so a single microtask is not enough. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
    // clearAllMocks does not undo jest.spyOn, so without this the Date.now stub
    // from the recovery test would leak into every test after it.
    jest.restoreAllMocks()
    create.mockReturnValue(fire)
    fire.mockResolvedValue(undefined)
    mockIsCapacitor.mockReturnValue(false)
    mockLoadStarShapes.mockImplementation((heights: readonly number[]) => Promise.resolve(heights.map(starShape)))
    setReducedMotion(false)
})

describe('the standard burst', () => {
    it('fires one burst of 40 flat brand stars in two sizes', async () => {
        const { shootStarConfetti } = await loadConfetti()

        shootStarConfetti()
        await flush()

        expect(fire).toHaveBeenCalledTimes(1)
        expect(mockLoadStarShapes).toHaveBeenCalledWith([50, 36])
        const [options] = fire.mock.calls[0]
        expect(options).toMatchObject({
            particleCount: 40,
            flat: true,
            startVelocity: 17,
            spread: 360,
            origin: { x: 0.5, y: 0.4 },
        })
        expect(options.shapes).toEqual([starShape(50), starShape(36)])
        // The stars carry their own colours; tinting is only for the fallback.
        expect(options.colors).toBeUndefined()
    })

    it('lets a burst be anchored to an element', async () => {
        const { shootStarConfetti } = await loadConfetti()

        shootStarConfetti({ origin: { x: 0.2, y: 0.7 } })
        await flush()

        expect(fire.mock.calls[0][0].origin).toEqual({ x: 0.2, y: 0.7 })
    })

    it('rasterises the star once and reuses it for later bursts', async () => {
        const { shootStarConfetti } = await loadConfetti()
        const now = Date.now()

        shootStarConfetti()
        await flush()
        jest.spyOn(Date, 'now').mockReturnValue(now + 5_000)
        shootStarConfetti()
        await flush()

        expect(fire).toHaveBeenCalledTimes(2)
        expect(mockLoadStarShapes).toHaveBeenCalledTimes(1)
    })

    it('falls back to a yellow star when the star file cannot be drawn, then retries it', async () => {
        mockLoadStarShapes.mockRejectedValueOnce(new Error('star.svg failed to load'))
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
        const { shootStarConfetti } = await loadConfetti()
        const now = Date.now()

        shootStarConfetti()
        await flush()

        expect(fire.mock.calls[0][0]).toMatchObject({ shapes: ['star'], colors: ['#ffc900'], particleCount: 40 })
        expect(warn).toHaveBeenCalledWith('[confetti] star shape failed, using the fallback star:', expect.any(Error))

        jest.spyOn(Date, 'now').mockReturnValue(now + 5_000)
        shootStarConfetti()
        await flush()

        expect(fire.mock.calls[1][0].shapes).toEqual([starShape(50), starShape(36)])
    })

    it('does not wait on a slow star file — the burst goes out with the fallback star', async () => {
        let finishLoad: (shapes: ReturnType<typeof starShape>[]) => void = () => {}
        mockLoadStarShapes.mockImplementationOnce(() => new Promise((resolve) => (finishLoad = resolve)))
        jest.spyOn(console, 'warn').mockImplementation(() => {})
        const { shootStarConfetti } = await loadConfetti()
        const now = Date.now()

        shootStarConfetti()
        await new Promise((resolve) => setTimeout(resolve, 850))

        expect(fire).toHaveBeenCalledTimes(1)
        expect(fire.mock.calls[0][0]).toMatchObject({ shapes: ['star'], colors: ['#ffc900'] })

        // The load carried on: the next burst gets the brand star without a second load.
        finishLoad([starShape(50), starShape(36)])
        jest.spyOn(Date, 'now').mockReturnValue(now + 5_000)
        shootStarConfetti()
        await flush()

        expect(fire.mock.calls[1][0].shapes).toEqual([starShape(50), starShape(36)])
        expect(mockLoadStarShapes).toHaveBeenCalledTimes(1)
    })
})

describe('prefers-reduced-motion', () => {
    it('tones the burst down rather than suppressing it — less motion, not no feedback', async () => {
        setReducedMotion(true)
        const { shootStarConfetti } = await loadConfetti()

        shootStarConfetti()
        await flush()

        expect(fire).toHaveBeenCalledTimes(1)
        expect(mockLoadStarShapes).toHaveBeenCalledWith([36])
        const [options] = fire.mock.calls[0]
        expect(options.particleCount).toBe(8)
        expect(options.startVelocity).toBe(7)
        expect(options.ticks).toBe(40)
        expect(options.flat).toBe(true)
    })

    it('never asks canvas-confetti to disable itself for reduced motion', async () => {
        setReducedMotion(true)
        const { shootStarConfetti } = await loadConfetti()

        shootStarConfetti()
        await flush()

        const [options] = fire.mock.calls[0]
        expect(options.disableForReducedMotion).toBeUndefined()
    })
})

describe('native', () => {
    it('renders on the main thread — a transferred canvas cannot be recovered in a WebView', async () => {
        mockIsCapacitor.mockReturnValue(true)
        const { shootStarConfetti } = await loadConfetti()

        shootStarConfetti()
        await flush()

        expect(create).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ useWorker: false }))
    })

    it('keeps the worker on web, where a page load heals a dead one', async () => {
        const { shootStarConfetti } = await loadConfetti()

        shootStarConfetti()
        await flush()

        expect(create).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ useWorker: true }))
    })

    it('fires the same burst as the web — one standard, no lighter native variant', async () => {
        mockIsCapacitor.mockReturnValue(true)
        const { shootStarConfetti } = await loadConfetti()

        shootStarConfetti()
        await flush()

        expect(fire).toHaveBeenCalledTimes(1)
        expect(fire.mock.calls[0][0].particleCount).toBe(40)
    })
})

describe('recovery', () => {
    it('rebuilds the instance after a failure instead of staying dead all session', async () => {
        create.mockImplementationOnce(() => {
            throw new Error('OffscreenCanvas transfer failed')
        })
        const { shootStarConfetti } = await loadConfetti()
        jest.spyOn(console, 'warn').mockImplementation(() => {})

        shootStarConfetti()
        await flush()
        expect(fire).not.toHaveBeenCalled()

        // Past the 1.5s throttle, a later celebration must get a fresh instance.
        jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 5_000)
        shootStarConfetti()
        await flush()

        expect(fire).toHaveBeenCalled()
    })

    it('swallows nothing — a failed burst is logged', async () => {
        create.mockImplementationOnce(() => {
            throw new Error('boom')
        })
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
        const { shootStarConfetti } = await loadConfetti()

        shootStarConfetti()
        await flush()

        expect(warn).toHaveBeenCalledWith('[confetti] burst failed:', expect.any(Error))
    })
})

describe('throttle', () => {
    it('swallows a duplicate celebration racing on the same screen', async () => {
        const { shootStarConfetti } = await loadConfetti()

        shootStarConfetti()
        shootStarConfetti()
        await flush()

        expect(fire).toHaveBeenCalledTimes(1)
    })
})

export {}
