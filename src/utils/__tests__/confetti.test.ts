/**
 * Confetti has broken twice with nothing covering it: once by being suppressed
 * outright under prefers-reduced-motion, once by wedging permanently after a
 * single failure on a document that never reloads. Both are asserted here.
 */
const fire = jest.fn().mockResolvedValue(undefined)
const create = jest.fn(() => fire)

jest.mock('canvas-confetti', () => ({ __esModule: true, default: { create } }))

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
    setReducedMotion(false)
})

describe('prefers-reduced-motion', () => {
    it('still fires a burst — the preference means less motion, not no feedback', async () => {
        setReducedMotion(true)
        const { shootDoubleStarConfetti } = await loadConfetti()

        shootDoubleStarConfetti()
        await flush()

        expect(fire).toHaveBeenCalled()
    })

    it('tones the burst down rather than suppressing it', async () => {
        setReducedMotion(true)
        const { shootStarConfetti } = await loadConfetti()

        shootStarConfetti({ particleCount: 100 })
        await flush()

        const [options] = fire.mock.calls[0]
        expect(options.particleCount).toBe(25)
        expect(options.startVelocity).toBeLessThan(15)
        expect(options.ticks).toBeLessThan(80)
        expect(options.spread).toBeLessThan(360)
    })

    it('never asks canvas-confetti to disable itself for reduced motion', async () => {
        setReducedMotion(true)
        const { shootStarConfetti } = await loadConfetti()

        shootStarConfetti()
        await flush()

        const [options] = fire.mock.calls[0]
        expect(options.disableForReducedMotion).toBeUndefined()
    })

    it('collapses the double burst to one', async () => {
        setReducedMotion(true)
        const { shootDoubleStarConfetti } = await loadConfetti()

        shootDoubleStarConfetti()
        await flush()

        expect(fire).toHaveBeenCalledTimes(1)
    })

    it('leaves the full burst alone when motion is not restricted', async () => {
        const { shootStarConfetti } = await loadConfetti()

        shootStarConfetti({ particleCount: 100 })
        await flush()

        const [options] = fire.mock.calls[0]
        expect(options.particleCount).toBe(100)
        expect(options.startVelocity).toBe(15)
        expect(options.spread).toBe(360)
    })

    it('fires both bursts on web at full motion', async () => {
        const { shootDoubleStarConfetti } = await loadConfetti()

        shootDoubleStarConfetti()
        await flush()

        expect(fire).toHaveBeenCalledTimes(2)
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

    it('collapses the double burst to one', async () => {
        mockIsCapacitor.mockReturnValue(true)
        const { shootDoubleStarConfetti } = await loadConfetti()

        shootDoubleStarConfetti()
        await flush()

        expect(fire).toHaveBeenCalledTimes(1)
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
