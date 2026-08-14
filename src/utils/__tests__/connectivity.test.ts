import {
    __resetConnectivityForTests,
    clearRecentFailures,
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
    it('counts distinct failing endpoints inside the window', () => {
        expect(getRecentFailures()).toBe(0)

        reportNetworkError('/users/me')
        reportNetworkError('/users/history')
        expect(getRecentFailures()).toBe(2)
    })

    it('dedupes retries of the same endpoint to one failure', () => {
        // React Query FAST retries: 3 attempts on one slow route must not
        // read as an app-wide connectivity problem.
        reportNetworkError('/users/history')
        reportNetworkError('/users/history')
        reportNetworkError('/users/history')
        expect(getRecentFailures()).toBe(1)
    })

    it('expires failures once they age out of the window', () => {
        reportNetworkError('/a')
        jest.advanceTimersByTime(FAILURE_WINDOW_MS / 2)
        reportNetworkError('/b')
        expect(getRecentFailures()).toBe(2)

        jest.advanceTimersByTime(FAILURE_WINDOW_MS / 2)
        expect(getRecentFailures()).toBe(1)

        jest.advanceTimersByTime(FAILURE_WINDOW_MS / 2)
        expect(getRecentFailures()).toBe(0)
    })

    it('prunes on read, not only via timers (freeze/sleep safety)', () => {
        reportNetworkError('/a')
        reportNetworkError('/b')
        // simulate suspended timers: advance the clock without running them
        jest.setSystemTime(Date.now() + FAILURE_WINDOW_MS + 1000)
        expect(getRecentFailures()).toBe(0)
    })

    it('clearRecentFailures drops the window and notifies', () => {
        let calls = 0
        const unsubscribe = subscribeConnectivity(() => {
            calls += 1
        })
        reportNetworkError('/a')
        reportNetworkError('/b')

        clearRecentFailures()
        expect(getRecentFailures()).toBe(0)
        expect(calls).toBe(3)

        // no-op when already empty — no redundant emit
        clearRecentFailures()
        expect(calls).toBe(3)
        unsubscribe()
    })

    it('notifies subscribers on each failure and after expiry', () => {
        const seen: number[] = []
        const unsubscribe = subscribeConnectivity(() => seen.push(getRecentFailures()))

        reportNetworkError('/a')
        reportNetworkError('/b')
        expect(seen).toEqual([1, 2])

        jest.advanceTimersByTime(FAILURE_WINDOW_MS + 100)
        expect(seen[seen.length - 1]).toBe(0)
        unsubscribe()
    })

    it('stops notifying after unsubscribe', () => {
        let calls = 0
        const unsubscribe = subscribeConnectivity(() => {
            calls += 1
        })
        reportNetworkError('/a')
        unsubscribe()
        reportNetworkError('/b')

        expect(calls).toBe(1)
    })
})
