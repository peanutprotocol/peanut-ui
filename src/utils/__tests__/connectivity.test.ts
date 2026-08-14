import {
    FAILURE_WINDOW_MS,
    getMsUntilNextExpiry,
    getRecentFailures,
    reportNetworkError,
    resetConnectivity,
    subscribeConnectivity,
} from '../connectivity'

// Module state is shared across tests, so reset to a known-good state each time.
beforeEach(() => {
    jest.useFakeTimers()
    resetConnectivity()
})

afterEach(() => {
    jest.useRealTimers()
})

describe('connectivity', () => {
    it('counts failures inside the window', () => {
        expect(getRecentFailures()).toBe(0)

        reportNetworkError()
        reportNetworkError()
        expect(getRecentFailures()).toBe(2)
    })

    it('expires failures once they age out of the window', () => {
        reportNetworkError()
        jest.advanceTimersByTime(FAILURE_WINDOW_MS / 2)
        reportNetworkError()
        expect(getRecentFailures()).toBe(2)

        jest.advanceTimersByTime(FAILURE_WINDOW_MS / 2)
        expect(getRecentFailures()).toBe(1)

        jest.advanceTimersByTime(FAILURE_WINDOW_MS / 2)
        expect(getRecentFailures()).toBe(0)
    })

    it('reports when the oldest failure will expire', () => {
        expect(getMsUntilNextExpiry()).toBeNull()

        reportNetworkError()
        jest.advanceTimersByTime(10_000)
        reportNetworkError()

        expect(getMsUntilNextExpiry()).toBe(FAILURE_WINDOW_MS - 10_000)
    })

    it('notifies subscribers on each failure', () => {
        const seen: number[] = []
        const unsubscribe = subscribeConnectivity(() => seen.push(getRecentFailures()))

        reportNetworkError()
        reportNetworkError()

        expect(seen).toEqual([1, 2])
        unsubscribe()
    })

    it('stops notifying after unsubscribe', () => {
        let calls = 0
        const unsubscribe = subscribeConnectivity(() => {
            calls += 1
        })
        reportNetworkError()
        unsubscribe()
        reportNetworkError()

        expect(calls).toBe(1)
    })
})
