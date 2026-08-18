/**
 * PeanutMascot — render, accessibility and reduced-motion tests.
 * lottie-web is mocked: jsdom cannot render SVG, and the point here is the wiring
 * (autoplay off, driven by our own clock) rather than the drawing.
 */
import PeanutMascot from '@/components/Global/PeanutMascot'
import {
    MASCOT_ART_BOXES,
    MASCOT_ART_FILL,
    MASCOT_CANVAS_HEIGHT,
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

describe('MASCOT_ART_BOXES', () => {
    // The art boxes are measured against a fixed comp size that is duplicated in
    // MASCOT_CANVAS_WIDTH/HEIGHT. Re-export one rig at a different canvas size and every
    // placement using it silently mis-centres, with nothing else in the suite noticing.
    it('matches the canvas every rig is actually authored on', () => {
        const poses = Object.keys(MASCOT_ART_BOXES) as (keyof typeof MASCOT_ART_BOXES)[]
        expect(poses).toHaveLength(10)

        for (const pose of poses) {
            const comp = require(`@/assets/mascot/lottie/${pose}.json`)
            expect([pose, comp.w, comp.h]).toEqual([pose, MASCOT_CANVAS_WIDTH, MASCOT_CANVAS_HEIGHT])

            // The art box drives placement, so it has to be a real, positive box. It is
            // NOT required to sit inside the canvas: 'walking' reaches 16.8 units past the
            // bottom edge mid-stride. That is a property of the rig, it was equally true of
            // the sprite rendered from the same comp, and it is harmless here because the
            // art box — overflow included — is what gets fitted to the host.
            const art = MASCOT_ART_BOXES[pose]
            expect(art.w).toBeGreaterThan(0)
            expect(art.h).toBeGreaterThan(0)
            expect(art.w).toBeLessThanOrEqual(MASCOT_CANVAS_WIDTH)
            expect(art.h).toBeLessThanOrEqual(MASCOT_CANVAS_HEIGHT)
        }
    })
})

describe('mascot sizing', () => {
    type Pose = keyof typeof MASCOT_ART_BOXES

    it('gives the host the pose art aspect, so a height-only box fits the pose', async () => {
        const { container } = render(<PeanutMascot pose="waving-chill" className="h-[35dvh]" />)

        await waitFor(() => expect(mockLoadAnimation).toHaveBeenCalled())
        const host = container.firstElementChild as HTMLElement
        const art = MASCOT_ART_BOXES['waving-chill']
        expect(parseFloat(host.style.aspectRatio)).toBeCloseTo(art.w / art.h, 6)
    })

    // The reason the aspect above exists: the poses are 0.55 to 1.21 wide-to-tall, so a
    // square box fits the wider dimension and the wide poses come out short. Given each
    // pose the box its own aspect asks for and every one renders at the same height.
    it('renders every pose at the same height once the box carries its aspect', () => {
        const hostHeight = 300

        for (const pose of Object.keys(MASCOT_ART_BOXES) as Pose[]) {
            const art = MASCOT_ART_BOXES[pose]
            const placement = getMascotPlacement(pose, hostHeight * (art.w / art.h), hostHeight)
            const artHeight = (placement.height * art.h) / MASCOT_CANVAS_HEIGHT

            expect([pose, artHeight]).toEqual([pose, expect.closeTo(hostHeight * MASCOT_ART_FILL, 6)])
        }
    })
})
