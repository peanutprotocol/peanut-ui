import { renderHook, act } from '@testing-library/react'
import { useSubmissionWindow, markSubmitted, __resetSubmissionWindowForTests } from '@/hooks/useSubmissionWindow'

describe('useSubmissionWindow', () => {
    beforeEach(() => {
        __resetSubmissionWindowForTests()
        jest.useFakeTimers()
    })
    afterEach(() => {
        jest.useRealTimers()
        __resetSubmissionWindowForTests()
    })

    it('returns isInWindow=false by default', () => {
        const { result } = renderHook(() => useSubmissionWindow())
        expect(result.current.isInWindow).toBe(false)
    })

    it('flips isInWindow=true after markSubmitted()', () => {
        const { result } = renderHook(() => useSubmissionWindow())
        act(() => {
            markSubmitted()
        })
        expect(result.current.isInWindow).toBe(true)
    })

    it('expires after 30s and re-renders consumers', () => {
        const { result } = renderHook(() => useSubmissionWindow())
        act(() => {
            markSubmitted()
        })
        expect(result.current.isInWindow).toBe(true)
        act(() => {
            jest.advanceTimersByTime(29_999)
        })
        expect(result.current.isInWindow).toBe(true)
        act(() => {
            jest.advanceTimersByTime(2)
        })
        expect(result.current.isInWindow).toBe(false)
    })

    it('rescheduling markSubmitted() resets the timer (later write wins)', () => {
        const { result } = renderHook(() => useSubmissionWindow())
        act(() => {
            markSubmitted()
        })
        act(() => {
            jest.advanceTimersByTime(20_000)
        })
        // 20s in, second write happens — window should extend another full 30s.
        act(() => {
            markSubmitted()
        })
        act(() => {
            jest.advanceTimersByTime(20_000)
        })
        // 40s after the first call but only 20s after the second — still in window.
        expect(result.current.isInWindow).toBe(true)
        act(() => {
            jest.advanceTimersByTime(15_000)
        })
        expect(result.current.isInWindow).toBe(false)
    })

    it('two consumers receive the same isInWindow value', () => {
        const a = renderHook(() => useSubmissionWindow())
        const b = renderHook(() => useSubmissionWindow())
        expect(a.result.current.isInWindow).toBe(false)
        expect(b.result.current.isInWindow).toBe(false)
        act(() => {
            markSubmitted()
        })
        expect(a.result.current.isInWindow).toBe(true)
        expect(b.result.current.isInWindow).toBe(true)
    })
})
