import { act, render } from '@testing-library/react'
import OnboardingAnimation from '../OnboardingAnimation'

const mockEvents: Record<string, () => void> = {}
const mockMotionListeners = new Set<() => void>()
const mockMotion = {
    matches: false,
    addEventListener: (_: string, listener: () => void) => mockMotionListeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => mockMotionListeners.delete(listener),
}
const mockAnimation = {
    setSpeed: jest.fn(),
    play: jest.fn(),
    pause: jest.fn(),
    goToAndPlay: jest.fn(),
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
let mockHidden = false
beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    Object.keys(mockEvents).forEach((key) => delete mockEvents[key])
    mockMotionListeners.clear()
    mockMotion.matches = false
    mockHidden = false
    jest.spyOn(window, 'matchMedia').mockImplementation(() => mockMotion as unknown as MediaQueryList)
    jest.spyOn(document, 'hidden', 'get').mockImplementation(() => mockHidden)
})
afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
})
async function mount(name: 'username' | 'bank' | 'card') {
    let view!: ReturnType<typeof render>
    await act(async () => {
        view = render(<OnboardingAnimation name={name} />)
    })
    expect(mockLoad).toHaveBeenCalled()
    act(() => mockEvents.DOMLoaded())
    return view
}
it.each([
    ['username', 4],
    ['bank', 1],
] as const)('plays %s twice as fast as its former speed', async (name, speed) => {
    await mount(name)
    expect(mockAnimation.setSpeed).toHaveBeenCalledWith(speed)
    expect(mockLoad).toHaveBeenCalledWith(expect.objectContaining({ loop: true }))
})
it('holds the card for 1000ms after every completed cycle', async () => {
    await mount('card')
    expect(mockLoad).toHaveBeenCalledWith(expect.objectContaining({ loop: false }))
    for (let cycle = 1; cycle <= 2; cycle++) {
        act(() => mockEvents.complete())
        act(() => jest.advanceTimersByTime(999))
        expect(mockAnimation.goToAndPlay).toHaveBeenCalledTimes(cycle - 1)
        act(() => jest.advanceTimersByTime(1))
        expect(mockAnimation.goToAndPlay).toHaveBeenCalledTimes(cycle)
        expect(mockAnimation.goToAndPlay).toHaveBeenLastCalledWith(0, true)
    }
})
it('does not restart a hidden or unmounted card', async () => {
    const view = await mount('card')
    act(() => mockEvents.complete())
    act(() => {
        mockHidden = true
        document.dispatchEvent(new Event('visibilitychange'))
    })
    act(() => jest.advanceTimersByTime(1000))
    expect(mockAnimation.goToAndPlay).not.toHaveBeenCalled()
    act(() => {
        mockHidden = false
        document.dispatchEvent(new Event('visibilitychange'))
    })
    act(() => jest.advanceTimersByTime(1000))
    expect(mockAnimation.goToAndPlay).toHaveBeenCalledTimes(1)
    act(() => mockEvents.complete())
    view.unmount()
    act(() => jest.advanceTimersByTime(1000))
    expect(mockAnimation.goToAndPlay).toHaveBeenCalledTimes(1)
    expect(mockAnimation.destroy).toHaveBeenCalled()
})
it('cancels the card restart when reduced motion is enabled', async () => {
    await mount('card')
    act(() => mockEvents.complete())
    act(() => {
        mockMotion.matches = true
        mockMotionListeners.forEach((listener) => listener())
    })
    act(() => jest.advanceTimersByTime(1000))
    expect(mockAnimation.goToAndPlay).not.toHaveBeenCalled()
    expect(mockAnimation.goToAndStop).toHaveBeenCalledWith(0, true)
})
