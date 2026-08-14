import { act, renderHook } from '@testing-library/react'
import { useConnectivity } from '../useConnectivity'
import { FAILURE_WINDOW_MS, reportNetworkError, resetConnectivity } from '@/utils/connectivity'

beforeEach(() => {
    jest.useFakeTimers()
    resetConnectivity()
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
})

afterEach(() => {
    jest.useRealTimers()
})

describe('useConnectivity', () => {
    it('is quiet when online and requests succeed', () => {
        const { result } = renderHook(() => useConnectivity())
        expect(result.current.show).toBe(false)
    })

    it('flags the API unreachable only after the failure threshold', () => {
        const { result } = renderHook(() => useConnectivity())

        act(() => {
            reportNetworkError()
        })
        expect(result.current.isApiUnreachable).toBe(false) // one blip isn't enough

        act(() => {
            reportNetworkError()
        })
        expect(result.current.isApiUnreachable).toBe(true)
        expect(result.current.show).toBe(true)
    })

    // The bug this hook exists to fix: on a flaky connection parallel requests
    // interleave successes with failures. Successes must NOT reset the count
    // (the old consecutive counter did, so the banner never fired — TASK-21108).
    it('still trips when failures are spread out inside the window', () => {
        const { result } = renderHook(() => useConnectivity())

        act(() => {
            reportNetworkError()
        })
        act(() => {
            jest.advanceTimersByTime(10_000)
        })
        act(() => {
            reportNetworkError()
        })

        expect(result.current.isApiUnreachable).toBe(true)
    })

    it('clears once the failures age out of the window', () => {
        const { result } = renderHook(() => useConnectivity())

        act(() => {
            reportNetworkError()
            reportNetworkError()
        })
        expect(result.current.show).toBe(true)

        act(() => {
            jest.advanceTimersByTime(FAILURE_WINDOW_MS + 100)
        })
        expect(result.current.show).toBe(false)
    })

    it('shows offline when the device drops connectivity', () => {
        const { result } = renderHook(() => useConnectivity())

        act(() => {
            Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
            window.dispatchEvent(new Event('offline'))
        })

        expect(result.current.isOffline).toBe(true)
        expect(result.current.show).toBe(true)
    })
})
