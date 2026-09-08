import { act } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { DiceRoll, DICE_ROLL_MS } from '../DiceRoll'
import { updateAccessibilityPreferences } from '@/utils/accessibility-preferences'
import { impactHaptic, heavyImpactHaptic, cancelHaptic } from '@/utils/haptics'
jest.mock('@/utils/haptics', () => ({ impactHaptic: jest.fn(), heavyImpactHaptic: jest.fn(), cancelHaptic: jest.fn() }))
beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    window.localStorage.clear()
    window.matchMedia = jest
        .fn()
        .mockReturnValue({ matches: false, addEventListener: jest.fn(), removeEventListener: jest.fn() })
})
afterEach(() => jest.useRealTimers())
it('syncs haptics with the tumble and completes once', () => {
    const done = jest.fn()
    renderWithIntl(<DiceRoll onComplete={done} onCancel={jest.fn()} />)
    act(() => jest.advanceTimersByTime(DICE_ROLL_MS))
    expect(impactHaptic).toHaveBeenCalledTimes(5)
    expect(heavyImpactHaptic).toHaveBeenCalledTimes(1)
    expect(done).toHaveBeenCalledTimes(1)
})
it('cancels all scheduled work when closed', () => {
    const done = jest.fn()
    const { unmount } = renderWithIntl(<DiceRoll onComplete={done} onCancel={jest.fn()} />)
    unmount()
    act(() => jest.runAllTimers())
    expect(done).not.toHaveBeenCalled()
    expect(impactHaptic).not.toHaveBeenCalled()
    expect(cancelHaptic).toHaveBeenCalled()
})
it('skips the tumble and pulses for reduced motion', () => {
    window.matchMedia = jest
        .fn()
        .mockReturnValue({ matches: true, addEventListener: jest.fn(), removeEventListener: jest.fn() })
    const done = jest.fn()
    renderWithIntl(<DiceRoll onComplete={done} onCancel={jest.fn()} />)
    act(() => jest.advanceTimersByTime(200))
    expect(done).toHaveBeenCalledTimes(1)
    expect(impactHaptic).not.toHaveBeenCalled()
})

it('settles an active roll when Reduce motion is enabled in the app', () => {
    const done = jest.fn()
    renderWithIntl(<DiceRoll onComplete={done} onCancel={jest.fn()} />)
    act(() => updateAccessibilityPreferences({ motion: 'on' }))
    act(() => jest.advanceTimersByTime(DICE_ROLL_MS))
    expect(done).toHaveBeenCalledTimes(1)
    expect(impactHaptic).not.toHaveBeenCalled()
    expect(heavyImpactHaptic).not.toHaveBeenCalled()
})
