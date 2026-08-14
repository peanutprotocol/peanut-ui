import {
    __resetConnectivityForTests,
    FAILURE_WINDOW_MS,
    getRecentFailures,
    reportNetworkError,
    subscribeConnectivity,
} from '../connectivity'

// Module state is shared across tests, so reset to a known-good state each time.
beforeEach(() => {
    jest.useFakeTimers()
    __resetConnectivityForTests()
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

    it('expires each failure once it ages out of the window', () => {
        reportNetworkError()
        jest.advanceTimersByTime(FAILURE_WINDOW_MS / 2)
        reportNetworkError()
        expect(getRecentFailures()).toBe(2)

        jest.advanceTimersByTime(FAILURE_WINDOW_MS / 2)
        expect(getRecentFailures()).toBe(1)

        jest.advanceTimersByTime(FAILURE_WINDOW_MS / 2)
        expect(getRecentFailures()).toBe(0)
    })

    it('notifies subscribers on each failure AND on each expiry', () => {
        const seen: number[] = []
        const unsubscribe = subscribeConnectivity(() => seen.push(getRecentFailures()))

        reportNetworkError()
        reportNetworkError()
        expect(seen).toEqual([1, 2])

        jest.advanceTimersByTime(FAILURE_WINDOW_MS)
        expect(seen).toEqual([1, 2, 1, 0])
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
