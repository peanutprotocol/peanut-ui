/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react'
import { useExpiryCountdown } from '../useExpiryCountdown'

describe('useExpiryCountdown', () => {
    beforeEach(() => {
        jest.useFakeTimers()
        jest.setSystemTime(new Date('2026-11-05T12:00:00Z'))
    })
    afterEach(() => jest.useRealTimers())

    it('ticks down once a second and reads expired once the time is up', () => {
        const expiresAt = Date.now() + 2_000
        const { result } = renderHook(() => useExpiryCountdown(expiresAt, true))
        expect(result.current).toEqual({ timeLeft: '0:02', isExpired: false })

        act(() => jest.advanceTimersByTime(1_000))
        expect(result.current.timeLeft).toBe('0:01')

        act(() => jest.advanceTimersByTime(1_000))
        expect(result.current).toEqual({ timeLeft: null, isExpired: true })
    })

    it('stops ticking while not running', () => {
        const { result } = renderHook(() => useExpiryCountdown(Date.now() + 60_000, false))
        act(() => jest.advanceTimersByTime(5_000))
        expect(result.current.timeLeft).toBe('1:00')
    })

    it('never expires without an expiry time', () => {
        const { result } = renderHook(() => useExpiryCountdown(null, true))
        expect(result.current).toEqual({ timeLeft: null, isExpired: false })
    })
})
