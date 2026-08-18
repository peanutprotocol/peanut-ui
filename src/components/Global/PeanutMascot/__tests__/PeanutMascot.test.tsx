/**
 * PeanutMascot — render, accessibility and reduced-motion tests.
 * lottie-web is mocked: jsdom cannot render SVG, and the point here is the wiring
 * (autoplay off, driven by our own clock) rather than the drawing.
 */
import PeanutMascot from '@/components/Global/PeanutMascot'
import {
    MASCOT_ART_BOXES,
    MASCOT_ART_FILL,
    MASCOT_CANVAS_WIDTH,
} from '@/components/Global/PeanutMascot/PeanutMascot.consts'
import { getMascotPlacement, subscribeToMascotClock } from '@/components/Global/PeanutMascot/PeanutMascot.utils'
import { render, screen, waitFor } from '@testing-library/react'

const mockAnimation = {
    totalFrames: 20,
    frameRate: 30,
    goToAndStop: jest.fn(),
    destroy: jest.fn(),
}
const mockLoadAnimation = jest.fn((_config: Record<string, unknown>) => mockAnimation)

jest.mock('lottie-web/build/player/lottie_light', () => ({
    __esModule: true,
    default: { loadAnimation: (config: Record<string, unknown>) => mockLoadAnimation(config) },
}))

const setReducedMotion = (matches: boolean) => {
    Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: (query: string) => ({
            matches,
            media: query,
            onchange: null,
            addListener: jest.fn(),
            removeListener: jest.fn(),
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
            dispatchEvent: jest.fn(),
        }),
    })
}

beforeEach(() => {
    jest.clearAllMocks()
    setReducedMotion(false)
})

describe('PeanutMascot', () => {
    it('loads the pose animation without autoplay', async () => {
        render(<PeanutMascot pose="cheering" className="h-60 w-60" />)

        await waitFor(() => expect(mockLoadAnimation).toHaveBeenCalled())
        const config = mockLoadAnimation.mock.calls[0][0]
        expect(config.renderer).toBe('svg')
        expect(config.autoplay).toBe(false)
        expect(config.animationData).toBeDefined()
    })

    it('is decorative when no alt is given', async () => {
        const { container } = render(<PeanutMascot pose="sad" />)

        await waitFor(() => expect(mockLoadAnimation).toHaveBeenCalled())
        const host = container.firstElementChild as HTMLElement
        expect(host).toHaveAttribute('aria-hidden', 'true')
        expect(host).not.toHaveAttribute('role')
    })

    it('is a labelled image when alt is given', async () => {
        render(<PeanutMascot pose="thinking" alt="Peanut is thinking" />)

        await waitFor(() => expect(mockLoadAnimation).toHaveBeenCalled())
        const host = screen.getByRole('img', { name: 'Peanut is thinking' })
        expect(host).not.toHaveAttribute('aria-hidden')
    })

    it('holds a static frame and never starts the clock under prefers-reduced-motion', async () => {
        setReducedMotion(true)
        const requestFrame = jest.spyOn(window, 'requestAnimationFrame')

        render(<PeanutMascot pose="walking" />)

        await waitFor(() => expect(mockAnimation.goToAndStop).toHaveBeenCalledWith(0, true))
        expect(requestFrame).not.toHaveBeenCalled()
        requestFrame.mockRestore()
    })

    it('destroys the animation on unmount', async () => {
        const { unmount } = render(<PeanutMascot pose="worried" />)

        await waitFor(() => expect(mockLoadAnimation).toHaveBeenCalled())
        unmount()
        expect(mockAnimation.destroy).toHaveBeenCalled()
    })
})

describe('getMascotPlacement', () => {
    it('fills the host box with the artwork, not the canvas', () => {
        const placement = getMascotPlacement('thinking', 240, 240)
        const art = MASCOT_ART_BOXES.thinking
        const scale = placement.width / MASCOT_CANVAS_WIDTH

        // The tall, narrow pose is height-bound, so the art spans ART_FILL of the box.
        expect(art.h * scale).toBeCloseTo(240 * MASCOT_ART_FILL, 5)
        // ...and its centre lands on the centre of the host box.
        expect(placement.left + (art.x + art.w / 2) * scale).toBeCloseTo(120, 5)
        expect(placement.top + (art.y + art.h / 2) * scale).toBeCloseTo(120, 5)
    })

    it('renders every pose at the same art height in a square box', () => {
        const heights = Object.entries(MASCOT_ART_BOXES).map(([pose, art]) => {
            const placement = getMascotPlacement(pose as keyof typeof MASCOT_ART_BOXES, 240, 240)
            return art.h * (placement.width / MASCOT_CANVAS_WIDTH)
        })

        // Only 'waving-chill' is wide enough to be width-bound; the rest are height-bound.
        expect(Math.max(...heights)).toBeCloseTo(240 * MASCOT_ART_FILL, 5)
        expect(Math.min(...heights)).toBeGreaterThan(240 * MASCOT_ART_FILL * 0.8)
    })
})

describe('subscribeToMascotClock', () => {
    // The loop is module-level shared state, so a leak here burns a rAF on every page for
    // the rest of the session. A ticker that unsubscribes from inside its own tick (what a
    // loop={false} pose does on its last frame) used to leave the loop re-arming forever.
    it('stops the loop when the last ticker unsubscribes from inside its own tick', () => {
        const pending = new Map<number, FrameRequestCallback>()
        let nextHandle = 1
        const raf = jest.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
            const handle = nextHandle++
            pending.set(handle, cb)
            return handle
        })
        const caf = jest.spyOn(window, 'cancelAnimationFrame').mockImplementation((handle) => {
            pending.delete(handle)
        })

        const runPendingFrame = (time: number) => {
            const [handle, cb] = [...pending.entries()][0]
            pending.delete(handle)
            cb(time)
        }

        try {
            let stop = () => {}
            stop = subscribeToMascotClock(() => stop())
            expect(pending.size).toBe(1)

            runPendingFrame(16)

            // The tick unsubscribed, so nothing should be queued for the next frame.
            expect(pending.size).toBe(0)
        } finally {
            raf.mockRestore()
            caf.mockRestore()
        }
    })
})
