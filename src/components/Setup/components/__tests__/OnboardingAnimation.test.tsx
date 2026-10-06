import { act, render } from '@testing-library/react'
import { MASCOT_HOLD_FRAMES, MASCOT_SPEED } from '@/components/Global/PeanutMascot/PeanutMascot.consts'
import OnboardingAnimation, { CARD_RESTART_DELAY_MS } from '../OnboardingAnimation'

const mockEvents: Record<string, () => void> = {}
const mockMotionListeners = new Set<() => void>()
const mockMotion = {
    matches: false,
    addEventListener: (_: string, listener: () => void) => mockMotionListeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => mockMotionListeners.delete(listener),
}
const mockAnimation = {
    frameRate: 30,
    totalFrames: 60,
    goToAndStop: jest.fn(),
    destroy: jest.fn(),
    addEventListener: jest.fn((name: string, fn: () => void) => {
        mockEvents[name] = fn
    }),
}
const mockLoad = jest.fn((..._args: unknown[]) => mockAnimation)
jest.mock('lottie-web/build/player/lottie_light', () => ({
    __esModule: true,
    default: { loadAnimation: (...args: unknown[]) => mockLoad(...args) },
}))
const mockTicks = new Set<(deltaSeconds: number) => void>()
jest.mock('@/components/Global/PeanutMascot/PeanutMascot.utils', () => ({
    subscribeToMascotClock: (tick: (deltaSeconds: number) => void) => {
        mockTicks.add(tick)
        return () => mockTicks.delete(tick)
    },
}))

const STEP_SECONDS = MASCOT_HOLD_FRAMES / (30 * MASCOT_SPEED)
const advanceClock = (seconds: number) => act(() => mockTicks.forEach((tick) => tick(seconds)))

let mockHidden = false
beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    Object.keys(mockEvents).forEach((key) => delete mockEvents[key])
    mockMotionListeners.clear()
    mockTicks.clear()
    mockMotion.matches = false
    mockHidden = false
    jest.spyOn(window, 'matchMedia').mockImplementation(() => mockMotion as unknown as MediaQueryList)
    jest.spyOn(document, 'hidden', 'get').mockImplementation(() => mockHidden)
})
afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
})
async function mount(name: 'username' | 'bank' | 'card' | 'fees') {
    let view!: ReturnType<typeof render>
    await act(async () => {
        view = render(<OnboardingAnimation name={name} />)
    })
    expect(mockLoad).toHaveBeenCalled()
    act(() => mockEvents.DOMLoaded())
    return view
}

it('updates on the mascot’s held-frame rhythm instead of every display frame', async () => {
    await mount('bank')
    expect(mockLoad).toHaveBeenCalledWith(expect.objectContaining({ loop: true, autoplay: false }))
    advanceClock(STEP_SECONDS * 0.6)
    expect(mockAnimation.goToAndStop).not.toHaveBeenCalled()
    advanceClock(STEP_SECONDS * 0.6)
    expect(mockAnimation.goToAndStop).toHaveBeenCalledTimes(1)
    expect(mockAnimation.goToAndStop.mock.calls[0][0]).toBeCloseTo(STEP_SECONDS * 30)
})

it.each([
    ['username', 4],
    ['fees', 0.5],
    ['bank', 1],
] as const)('runs %s at tempo %s on that shared rhythm', async (name, tempo) => {
    await mount(name)
    advanceClock(STEP_SECONDS)
    expect(mockAnimation.goToAndStop.mock.calls[0][0]).toBeCloseTo(STEP_SECONDS * 30 * tempo)
})

it('holds the card on its last frame for the restart delay after every cycle', async () => {
    await mount('card')
    expect(mockLoad).toHaveBeenCalledWith(expect.objectContaining({ loop: false }))
    for (let cycle = 1; cycle <= 2; cycle++) {
        advanceClock(60 / 30 + STEP_SECONDS)
        expect(mockAnimation.goToAndStop).toHaveBeenLastCalledWith(59, true)
        expect(mockTicks.size).toBe(0)
        act(() => jest.advanceTimersByTime(CARD_RESTART_DELAY_MS - 1))
        expect(mockAnimation.goToAndStop).toHaveBeenLastCalledWith(59, true)
        act(() => jest.advanceTimersByTime(1))
        expect(mockAnimation.goToAndStop).toHaveBeenLastCalledWith(0, true)
        expect(mockTicks.size).toBe(1)
    }
})

it('pauses while the page is hidden and does not restart a hidden or unmounted card', async () => {
    const view = await mount('card')
    advanceClock(60 / 30 + STEP_SECONDS)
    act(() => {
        mockHidden = true
        document.dispatchEvent(new Event('visibilitychange'))
    })
    act(() => jest.advanceTimersByTime(CARD_RESTART_DELAY_MS))
    expect(mockAnimation.goToAndStop).not.toHaveBeenCalledWith(0, true)
    act(() => {
        mockHidden = false
        document.dispatchEvent(new Event('visibilitychange'))
    })
    act(() => jest.advanceTimersByTime(CARD_RESTART_DELAY_MS))
    expect(mockAnimation.goToAndStop).toHaveBeenLastCalledWith(0, true)
    advanceClock(60 / 30 + STEP_SECONDS)
    view.unmount()
    mockAnimation.goToAndStop.mockClear()
    act(() => jest.advanceTimersByTime(CARD_RESTART_DELAY_MS))
    expect(mockAnimation.goToAndStop).not.toHaveBeenCalled()
    expect(mockTicks.size).toBe(0)
    expect(mockAnimation.destroy).toHaveBeenCalled()
})

it('stops the clock while hidden and resumes when visible again', async () => {
    await mount('bank')
    expect(mockTicks.size).toBe(1)
    act(() => {
        mockHidden = true
        document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(mockTicks.size).toBe(0)
    act(() => {
        mockHidden = false
        document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(mockTicks.size).toBe(1)
})

it('cancels the card restart and shows a still frame when reduced motion is enabled', async () => {
    await mount('card')
    advanceClock(60 / 30 + STEP_SECONDS)
    act(() => {
        mockMotion.matches = true
        mockMotionListeners.forEach((listener) => listener())
    })
    expect(mockAnimation.goToAndStop).toHaveBeenLastCalledWith(0, true)
    mockAnimation.goToAndStop.mockClear()
    act(() => jest.advanceTimersByTime(CARD_RESTART_DELAY_MS))
    expect(mockAnimation.goToAndStop).not.toHaveBeenCalled()
    expect(mockTicks.size).toBe(0)
})
