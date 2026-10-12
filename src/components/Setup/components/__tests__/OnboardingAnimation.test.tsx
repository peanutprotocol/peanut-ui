import { act, render } from '@testing-library/react'
import OnboardingAnimation, { type OnboardingAnimationName } from '../OnboardingAnimation'
import { LOOP_HOLD_MS, planLoop, stillFrame } from '../loopPlayback.utils'

const mockEvents: Record<string, () => void> = {}
const mockMotionListeners = new Set<() => void>()
const mockMotion = {
    matches: false,
    addEventListener: (_: string, listener: () => void) => mockMotionListeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => mockMotionListeners.delete(listener),
}
const mockAnimation = {
    loop: false as boolean | number,
    totalFrames: 86,
    play: jest.fn(),
    pause: jest.fn(),
    playSegments: jest.fn(),
    goToAndStop: jest.fn(),
    destroy: jest.fn(),
    addEventListener: jest.fn((name: string, fn: () => void) => {
        mockEvents[name] = fn
    }),
}
// Like lottie, draw an SVG whose root group is clipped to the comp box.
const mockLoad = jest.fn((options: { container: HTMLElement }) => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g')
    group.setAttribute('clip-path', 'url(#comp)')
    svg.appendChild(group)
    options.container.appendChild(svg)
    return mockAnimation
})
jest.mock('lottie-web/build/player/lottie_light', () => ({
    __esModule: true,
    default: { loadAnimation: (options: { container: HTMLElement }) => mockLoad(options) },
}))
// Residence carries the full beat: intro 0-36, idle 36-74, outro 74-86.
jest.mock('@/assets/onboarding/residence.json', () => ({
    markers: [
        { cm: 'intro', tm: 0, dr: 36 },
        { cm: 'idle', tm: 36, dr: 38 },
        { cm: 'outro', tm: 74, dr: 12 },
    ],
}))
// Card holds its idle as one authored cycle (pp.idle_once): intro 0-36, idle 36-112, outro 112-124.
jest.mock('@/assets/onboarding/card.json', () => ({
    pp: { idle_once: true },
    markers: [
        { cm: 'intro', tm: 0, dr: 36 },
        { cm: 'idle', tm: 36, dr: 76 },
        { cm: 'outro', tm: 112, dr: 12 },
    ],
}))
jest.mock('@/assets/onboarding/accounts.json', () => ({ markers: [{ cm: 'idle', tm: 0, dr: 144 }] }))
jest.mock('@/assets/onboarding/username-at.json', () => ({ markers: [] }))

let mockHidden = false
beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    Object.keys(mockEvents).forEach((key) => delete mockEvents[key])
    mockMotionListeners.clear()
    mockMotion.matches = false
    mockHidden = false
    mockAnimation.loop = false
    jest.spyOn(window, 'matchMedia').mockImplementation(() => mockMotion as unknown as MediaQueryList)
    jest.spyOn(document, 'hidden', 'get').mockImplementation(() => mockHidden)
})
afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
})

async function mount(name: OnboardingAnimationName) {
    let view!: ReturnType<typeof render>
    await act(async () => {
        view = render(<OnboardingAnimation name={name} />)
    })
    expect(mockLoad).toHaveBeenCalled()
    act(() => mockEvents.DOMLoaded())
    return view
}

describe('planLoop', () => {
    it('reads intro, idle and outro segments from the markers', () => {
        const plan = planLoop(
            [
                { cm: 'intro', tm: 0, dr: 36 },
                { cm: 'idle', tm: 36, dr: 38 },
                { cm: 'outro', tm: 74, dr: 12 },
            ],
            86
        )
        expect(plan).toEqual({ kind: 'beat', intro: [0, 36], idle: [36, 74], outro: [74, 86], idleOnce: false })
        expect(stillFrame(plan)).toBe(36)
    })
    it('cycles a loop whose only marker is idle', () => {
        expect(planLoop([{ cm: 'idle', tm: 0, dr: 144 }], 144)).toEqual({ kind: 'idle', idle: [0, 144] })
    })
    it('loops a comp with no idle marker end to end, still on its first frame', () => {
        const plan = planLoop([], 60)
        expect(plan).toEqual({ kind: 'whole' })
        expect(stillFrame(plan)).toBe(0)
    })
    it('marks a beat whose idle is authored to play once', () => {
        expect(
            planLoop(
                [
                    { cm: 'intro', tm: 0, dr: 10 },
                    { cm: 'idle', tm: 10, dr: 20 },
                ],
                30,
                true
            )
        ).toMatchObject({
            kind: 'beat',
            idleOnce: true,
        })
    })
    it('restarts the intro when a beat has no outro, and an idle without length runs to the end', () => {
        expect(
            planLoop(
                [
                    { cm: 'intro', tm: 0 },
                    { cm: 'idle', tm: 40 },
                ],
                100
            )
        ).toEqual({
            kind: 'beat',
            intro: [0, 40],
            idle: [40, 100],
            outro: null,
            idleOnce: false,
        })
    })
})

describe('OnboardingAnimation', () => {
    it('plays the beat, holds the idle pose, then eases back and plays again', async () => {
        await mount('residence')
        expect(mockLoad).toHaveBeenCalledWith(expect.objectContaining({ loop: false, autoplay: false }))
        expect(mockAnimation.playSegments).toHaveBeenLastCalledWith([0, 36], true)

        act(() => mockEvents.complete())
        expect(mockAnimation.playSegments).toHaveBeenLastCalledWith([36, 74], true)
        expect(mockAnimation.loop).toBe(true)

        act(() => jest.advanceTimersByTime(LOOP_HOLD_MS - 1))
        expect(mockAnimation.playSegments).toHaveBeenLastCalledWith([36, 74], true)
        act(() => jest.advanceTimersByTime(1))
        expect(mockAnimation.playSegments).toHaveBeenLastCalledWith([74, 86], true)
        expect(mockAnimation.loop).toBe(false)

        act(() => mockEvents.complete())
        expect(mockAnimation.playSegments).toHaveBeenLastCalledWith([0, 36], true)
    })

    it('plays a pp.idle_once idle a single time and runs straight into the outro, with no hold timer', async () => {
        await mount('card')
        expect(mockAnimation.playSegments).toHaveBeenLastCalledWith([0, 36], true)
        act(() => mockEvents.complete())
        expect(mockAnimation.playSegments).toHaveBeenLastCalledWith([36, 112], true)
        expect(mockAnimation.loop).toBe(false)
        act(() => jest.advanceTimersByTime(LOOP_HOLD_MS * 3))
        expect(mockAnimation.playSegments).toHaveBeenLastCalledWith([36, 112], true)
        act(() => mockEvents.complete())
        expect(mockAnimation.playSegments).toHaveBeenLastCalledWith([112, 124], true)
        act(() => mockEvents.complete())
        expect(mockAnimation.playSegments).toHaveBeenLastCalledWith([0, 36], true)
    })

    it('cycles an idle-only loop without a beat', async () => {
        await mount('accounts')
        expect(mockAnimation.playSegments).toHaveBeenCalledWith([0, 144], true)
        expect(mockAnimation.loop).toBe(true)
    })

    it('loops the username background end to end', async () => {
        await mount('username')
        expect(mockAnimation.play).toHaveBeenCalled()
        expect(mockAnimation.loop).toBe(true)
    })

    it('shows the held pose under reduced motion, and stops a running beat when it turns on', async () => {
        mockMotion.matches = true
        await mount('residence')
        expect(mockAnimation.goToAndStop).toHaveBeenCalledWith(36, true)
        expect(mockAnimation.playSegments).not.toHaveBeenCalled()
    })

    it('cancels the pending outro when reduced motion turns on mid-hold', async () => {
        await mount('residence')
        act(() => mockEvents.complete())
        act(() => {
            mockMotion.matches = true
            mockMotionListeners.forEach((listener) => listener())
        })
        act(() => jest.advanceTimersByTime(LOOP_HOLD_MS))
        expect(mockAnimation.playSegments).not.toHaveBeenCalledWith([74, 86], true)
        expect(mockAnimation.goToAndStop).toHaveBeenLastCalledWith(36, true)
    })

    it('pauses while the page is hidden and stops its timers on unmount', async () => {
        const view = await mount('residence')
        act(() => {
            mockHidden = true
            document.dispatchEvent(new Event('visibilitychange'))
        })
        expect(mockAnimation.pause).toHaveBeenCalled()
        act(() => {
            mockHidden = false
            document.dispatchEvent(new Event('visibilitychange'))
        })
        act(() => mockEvents.complete())
        view.unmount()
        act(() => jest.advanceTimersByTime(LOOP_HOLD_MS))
        expect(mockAnimation.playSegments).not.toHaveBeenCalledWith([74, 86], true)
        expect(mockAnimation.destroy).toHaveBeenCalled()
    })

    it('lets the loop draw past its comp box', async () => {
        const view = await mount('residence')
        const svg = view.container.querySelector('svg')
        expect(svg?.style.overflow).toBe('visible')
        expect(svg?.querySelector('g[clip-path]')).toBeNull()
    })
})
