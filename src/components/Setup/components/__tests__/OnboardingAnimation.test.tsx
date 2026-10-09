import { act, render } from '@testing-library/react'
import OnboardingAnimation, { CARD_RESTART_DELAY_MS } from '../OnboardingAnimation'

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
async function mount(name: 'username' | 'bank' | 'card' | 'fees') {
    let view!: ReturnType<typeof render>
    await act(async () => {
        view = render(<OnboardingAnimation name={name} />)
    })
    expect(mockLoad).toHaveBeenCalled()
    act(() => mockEvents.DOMLoaded())
    return view
}
it.each(['username', 'bank', 'fees'] as const)('plays %s smoothly at its baked-in pace', async (name) => {
    await mount(name)
    expect(mockLoad).toHaveBeenCalledWith(expect.objectContaining({ loop: true, autoplay: false }))
    expect(mockAnimation.play).toHaveBeenCalled()
    expect(mockAnimation.setSpeed).not.toHaveBeenCalled()
})
it('holds the card for the restart delay after every completed cycle', async () => {
    await mount('card')
    expect(mockLoad).toHaveBeenCalledWith(expect.objectContaining({ loop: false }))
    for (let cycle = 1; cycle <= 2; cycle++) {
        act(() => mockEvents.complete())
        act(() => jest.advanceTimersByTime(CARD_RESTART_DELAY_MS - 1))
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
    act(() => jest.advanceTimersByTime(CARD_RESTART_DELAY_MS))
    expect(mockAnimation.goToAndPlay).not.toHaveBeenCalled()
    act(() => {
        mockHidden = false
        document.dispatchEvent(new Event('visibilitychange'))
    })
    act(() => jest.advanceTimersByTime(CARD_RESTART_DELAY_MS))
    expect(mockAnimation.goToAndPlay).toHaveBeenCalledTimes(1)
    act(() => mockEvents.complete())
    view.unmount()
    act(() => jest.advanceTimersByTime(CARD_RESTART_DELAY_MS))
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
    act(() => jest.advanceTimersByTime(CARD_RESTART_DELAY_MS))
    expect(mockAnimation.goToAndPlay).not.toHaveBeenCalled()
    expect(mockAnimation.goToAndStop).toHaveBeenCalledWith(0, true)
})
it('shows the retimed fees still frame under reduced motion', async () => {
    mockMotion.matches = true
    await mount('fees')
    expect(mockAnimation.goToAndStop).toHaveBeenCalledWith(64, true)
    expect(mockAnimation.play).not.toHaveBeenCalled()
})
