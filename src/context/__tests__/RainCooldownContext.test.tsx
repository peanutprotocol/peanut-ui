import { act, renderHook } from '@testing-library/react'
import { ToastProvider } from '@/components/0_Bruddle/Toast'
import { RainCooldownProvider, useRainCooldown } from '../RainCooldownContext'

// Dispatch the same window event that `rainRequest` fires on a 425 from
// /withdraw/prepare with a real retryAfterSec. Decoupled from
// `RainCooldownError` itself so we can exercise the context without pulling
// the whole rain service module graph in.
function fireCooldown(retryAfterSec: number, message = 'cooling down') {
    window.dispatchEvent(new CustomEvent('rain:cooldown', { detail: { retryAfterSec, message } }))
}

const wrapper = ({ children }: { children: React.ReactNode }) => (
    <ToastProvider>
        <RainCooldownProvider>{children}</RainCooldownProvider>
    </ToastProvider>
)

describe('RainCooldownContext', () => {
    beforeEach(() => {
        jest.useFakeTimers()
    })
    afterEach(() => {
        act(() => {
            jest.runOnlyPendingTimers()
        })
        jest.useRealTimers()
    })

    it('activates cooldown + intro modal when the rain:cooldown event fires', () => {
        const { result } = renderHook(() => useRainCooldown(), { wrapper })
        expect(result.current.cooldownEndsAt).toBeNull()
        expect(result.current.showIntroModal).toBe(false)

        act(() => fireCooldown(120))

        expect(result.current.showIntroModal).toBe(true)
        expect(result.current.cooldownEndsAt).not.toBeNull()
        expect(result.current.cooldownEndsAt! - Date.now()).toBeGreaterThan(110_000)
    })

    it('dismissIntroModal hides the modal but keeps the cooldown live', () => {
        const { result } = renderHook(() => useRainCooldown(), { wrapper })
        act(() => fireCooldown(120))
        act(() => result.current.dismissIntroModal())
        expect(result.current.showIntroModal).toBe(false)
        expect(result.current.cooldownEndsAt).not.toBeNull()
    })

    it('clears cooldownEndsAt once the timer elapses', () => {
        const { result } = renderHook(() => useRainCooldown(), { wrapper })
        act(() => fireCooldown(5))
        expect(result.current.cooldownEndsAt).not.toBeNull()
        act(() => {
            jest.advanceTimersByTime(6_000)
        })
        expect(result.current.cooldownEndsAt).toBeNull()
    })

    it('does not shorten an existing longer cooldown', () => {
        const { result } = renderHook(() => useRainCooldown(), { wrapper })
        act(() => fireCooldown(300, 'long'))
        const firstEnd = result.current.cooldownEndsAt!
        act(() => fireCooldown(30, 'short'))
        // Either keeps the longer end-time or replaces it with one that's no
        // earlier — clock skew across event dispatches can shift by ms.
        expect(result.current.cooldownEndsAt).toBeGreaterThanOrEqual(firstEnd - 5)
    })

    it('does NOT re-pop the intro modal on a mid-cooldown retry', () => {
        const { result } = renderHook(() => useRainCooldown(), { wrapper })
        act(() => fireCooldown(300))
        expect(result.current.showIntroModal).toBe(true)
        act(() => result.current.dismissIntroModal())
        expect(result.current.showIntroModal).toBe(false)
        // Simulate the user retrying during the existing cooldown.
        act(() => fireCooldown(280))
        expect(result.current.showIntroModal).toBe(false)
    })

    it('re-pops the intro modal for a brand-new cooldown after the previous one cleared', () => {
        const { result } = renderHook(() => useRainCooldown(), { wrapper })
        act(() => fireCooldown(5))
        act(() => result.current.dismissIntroModal())
        act(() => jest.advanceTimersByTime(6_000))
        expect(result.current.cooldownEndsAt).toBeNull()
        // Brand new cooldown — modal should pop again.
        act(() => fireCooldown(120))
        expect(result.current.showIntroModal).toBe(true)
    })
})
