import { act, renderHook } from '@testing-library/react'
import { useConnectivity } from '../useConnectivity'
import { __resetConnectivityForTests, FAILURE_WINDOW_MS, reportNetworkError } from '@/utils/connectivity'

beforeEach(() => {
    jest.useFakeTimers()
    __resetConnectivityForTests()
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

    it('flags the API unreachable only after distinct endpoints fail', () => {
        const { result } = renderHook(() => useConnectivity())

        act(() => {
            reportNetworkError('/users/me')
        })
        expect(result.current.isApiUnreachable).toBe(false) // one endpoint isn't enough

        act(() => {
            reportNetworkError('/users/history')
        })
        expect(result.current.isApiUnreachable).toBe(true)
        expect(result.current.show).toBe(true)
    })

    it('does not trip on one slow endpoint being retried', () => {
        const { result } = renderHook(() => useConnectivity())

        act(() => {
            reportNetworkError('/users/history')
            reportNetworkError('/users/history')
            reportNetworkError('/users/history')
        })
        expect(result.current.isApiUnreachable).toBe(false)
    })

    // The bug this hook exists to fix: on a flaky connection parallel requests
    // interleave successes with failures. Successes must NOT reset the count
    // (the old consecutive counter did, so the banner never fired — TASK-21108).
    it('still trips when failures are spread out inside the window', () => {
        const { result } = renderHook(() => useConnectivity())

        act(() => {
            reportNetworkError('/users/me')
        })
        act(() => {
            jest.advanceTimersByTime(10_000)
        })
        act(() => {
            reportNetworkError('/rain/cards')
        })

        expect(result.current.isApiUnreachable).toBe(true)
    })

    it('clears once the failures age out of the window', () => {
        const { result } = renderHook(() => useConnectivity())

        act(() => {
            reportNetworkError('/a')
            reportNetworkError('/b')
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

    it('coming back online clears the failure window, not just the offline flag', () => {
        const { result } = renderHook(() => useConnectivity())

        act(() => {
            reportNetworkError('/a')
            reportNetworkError('/b')
            Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
            window.dispatchEvent(new Event('offline'))
        })
        expect(result.current.isOffline).toBe(true)

        act(() => {
            Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
            window.dispatchEvent(new Event('online'))
        })

        // without the online-clear this would flip to the "trouble reaching
        // Peanut" banner for up to a full window after reconnecting
        expect(result.current.isOffline).toBe(false)
        expect(result.current.isApiUnreachable).toBe(false)
        expect(result.current.show).toBe(false)
    })
})
