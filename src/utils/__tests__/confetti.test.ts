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

const silhouette = (height: number) => ({ type: 'path', path: `outline-${height}`, matrix: [1, 0, 0, 1, 0, 0] })
const mockStarSilhouettes = jest.fn((heights: readonly number[]) => heights.map(silhouette))
jest.mock('@/utils/confetti-star-silhouette', () => ({
    starSilhouettes: (heights: readonly number[]) => mockStarSilhouettes(heights),
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
    mockStarSilhouettes.mockImplementation((heights: readonly number[]) => heights.map(silhouette))
    setReducedMotion(false)
})

describe('the standard burst', () => {
    it('fires one burst of 40 flat brand stars in two sizes', async () => {
        const { shootDoubleStarConfetti } = await loadConfetti()

        shootDoubleStarConfetti()
        await flush()

        expect(fire).toHaveBeenCalledTimes(1)
        expect(mockLoadStarShapes).toHaveBeenCalledWith([50, 36])
        const [options] = fire.mock.calls[0]
        expect(options).toMatchObject({
            particleCount: 40,
            flat: true,
            startVelocity: 17,
            spread: 360,
            scalar: 1,
            origin: { x: 0.5, y: 0.6 },
        })
        expect(options.shapes).toEqual([starShape(50), starShape(36)])
        // The stars carry their own colours; tinting is only for the outline fallback.
        expect(options.colors).toBeUndefined()
    })

    it('rasterises the star once and reuses it for later bursts', async () => {
        const { shootDoubleStarConfetti } = await loadConfetti()
        const now = Date.now()

        shootDoubleStarConfetti()
        await flush()
        jest.spyOn(Date, 'now').mockReturnValue(now + 5_000)
        shootDoubleStarConfetti()
        await flush()

        expect(fire).toHaveBeenCalledTimes(2)
        expect(mockLoadStarShapes).toHaveBeenCalledTimes(1)
    })

    it('falls back to the same star as a yellow outline when the bitmap cannot be drawn, then retries it', async () => {
        mockLoadStarShapes.mockRejectedValueOnce(new Error('star.svg failed to load'))
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
        const { shootDoubleStarConfetti } = await loadConfetti()
        const now = Date.now()

        shootDoubleStarConfetti()
        await flush()

        // same sizes, same amount, same movement: only the drawing is simpler
        expect(fire.mock.calls[0][0]).toMatchObject({
            shapes: [silhouette(50), silhouette(36)],
            colors: ['#ffc900'],
            scalar: 1,
            flat: true,
            particleCount: 40,
        })
        expect(warn).toHaveBeenCalledWith('[confetti] star bitmap failed, using the star outline:', expect.any(Error))

        jest.spyOn(Date, 'now').mockReturnValue(now + 5_000)
        shootDoubleStarConfetti()
        await flush()

        expect(fire.mock.calls[1][0].shapes).toEqual([starShape(50), starShape(36)])
    })

    it('fires nothing rather than another shape when the outline cannot be drawn either', async () => {
        mockLoadStarShapes.mockRejectedValueOnce(new Error('bitmap confetti unsupported'))
        mockStarSilhouettes.mockImplementationOnce(() => {
            throw new Error('path confetti unsupported')
        })
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
        const { shootDoubleStarConfetti } = await loadConfetti()

        shootDoubleStarConfetti()
        await flush()

        expect(fire).not.toHaveBeenCalled()
        expect(warn).toHaveBeenCalledWith('[confetti] burst failed:', expect.any(Error))
    })

    it('waits for the star file instead of sending another star first', async () => {
        let finishLoad: (shapes: ReturnType<typeof starShape>[]) => void = () => {}
        mockLoadStarShapes.mockImplementationOnce(() => new Promise((resolve) => (finishLoad = resolve)))
        const { shootDoubleStarConfetti } = await loadConfetti()

        shootDoubleStarConfetti()
        await flush()
        expect(fire).not.toHaveBeenCalled()

        finishLoad([starShape(50), starShape(36)])
        await flush()

        expect(fire).toHaveBeenCalledTimes(1)
        expect(fire.mock.calls[0][0].shapes).toEqual([starShape(50), starShape(36)])
    })
})

describe('a screen tunes its own burst', () => {
    it('passes amount, start point and movement through, and keeps the look', async () => {
        const { shootDoubleStarConfetti } = await loadConfetti()

        shootDoubleStarConfetti({ origin: { x: 0.5, y: 0.3 }, particleCount: 30, spread: 180 })
        await flush()

        expect(fire.mock.calls[0][0]).toMatchObject({
            particleCount: 30,
            spread: 180,
            origin: { x: 0.5, y: 0.3 },
            flat: true,
            shapes: [starShape(50), starShape(36)],
        })
    })

    it('draws a smaller star for a smaller scalar instead of stretching the bitmap', async () => {
        const { shootStarConfetti } = await loadConfetti()

        shootStarConfetti({ particleCount: 10, scalar: 0.8, startVelocity: 10 })
        await flush()

        expect(mockLoadStarShapes).toHaveBeenCalledWith([40])
        expect(fire.mock.calls[0][0]).toMatchObject({ particleCount: 10, startVelocity: 10, scalar: 1 })
    })

    it('caps the star size so no caller can hand an old phone a huge bitmap', async () => {
        const { shootStarConfetti } = await loadConfetti()

        shootStarConfetti({ scalar: 10 })
        await flush()

        expect(mockLoadStarShapes).toHaveBeenCalledWith([64])
    })

    it('a single burst is 20 stars in one size', async () => {
        const { shootStarConfetti } = await loadConfetti()

        shootStarConfetti()
        await flush()

        expect(mockLoadStarShapes).toHaveBeenCalledWith([50])
        expect(fire.mock.calls[0][0].particleCount).toBe(20)
    })

    it.each([
        ['success', { particleCount: 40, origin: { x: 0.5, y: 0.6 } }, [50, 36]],
        ['celebration', { particleCount: 30, spread: 180, origin: { x: 0.5, y: 0.3 } }, [50, 36]],
        ['gentle', { particleCount: 10, startVelocity: 10 }, [40]],
    ] as const)('the %s preset keeps its tuning', async (name, expected, heights) => {
        const { confettiPresets } = await loadConfetti()

        confettiPresets[name]()
        await flush()

        expect(mockLoadStarShapes).toHaveBeenCalledWith(heights)
        expect(fire.mock.calls[0][0]).toMatchObject(expected)
    })
})

describe('prefers-reduced-motion', () => {
    it('tones the burst down rather than suppressing it — less motion, not no feedback', async () => {
        setReducedMotion(true)
        const { shootDoubleStarConfetti } = await loadConfetti()

        shootDoubleStarConfetti()
        await flush()

        expect(fire).toHaveBeenCalledTimes(1)
        expect(mockLoadStarShapes).toHaveBeenCalledWith([36])
        const [options] = fire.mock.calls[0]
        expect(options.particleCount).toBe(8)
        expect(options.startVelocity).toBe(7)
        expect(options.ticks).toBe(40)
        expect(options.flat).toBe(true)
    })

    it('keeps a quarter of a large burst', async () => {
        setReducedMotion(true)
        const { shootStarConfetti } = await loadConfetti()

        shootStarConfetti({ particleCount: 60 })
        await flush()

        expect(fire.mock.calls[0][0].particleCount).toBe(15)
    })

    it('fires the same few stars when only the outline can be drawn', async () => {
        setReducedMotion(true)
        mockLoadStarShapes.mockRejectedValueOnce(new Error('bitmap confetti unsupported'))
        jest.spyOn(console, 'warn').mockImplementation(() => {})
        const { shootDoubleStarConfetti } = await loadConfetti()

        shootDoubleStarConfetti()
        await flush()

        expect(fire.mock.calls[0][0]).toMatchObject({ shapes: [silhouette(36)], particleCount: 8, startVelocity: 7 })
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

    it('halves the double burst to one size', async () => {
        mockIsCapacitor.mockReturnValue(true)
        const { shootDoubleStarConfetti } = await loadConfetti()

        shootDoubleStarConfetti()
        await flush()

        expect(fire).toHaveBeenCalledTimes(1)
        expect(mockLoadStarShapes).toHaveBeenCalledWith([50])
        expect(fire.mock.calls[0][0].particleCount).toBe(20)
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
