import {
    __resetConnectivityForTests,
    clearRecentFailures,
    FAILURE_WINDOW_MS,
    getRecentFailures,
    hasRecentFailure,
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

describe('hasRecentFailure — one Sentry report per endpoint per outage', () => {
    it('is false the first time an endpoint fails and true afterwards', () => {
        expect(hasRecentFailure('/users/me')).toBe(false)

        reportNetworkError('/users/me')
        expect(hasRecentFailure('/users/me')).toBe(true)
    })

    it('does not suppress a different endpoint failing in the same window', () => {
        reportNetworkError('/users/me')
        expect(hasRecentFailure('/tokens/price')).toBe(false)
    })

    it('lets the endpoint be reported again once the window has passed', () => {
        reportNetworkError('/users/me')
        jest.advanceTimersByTime(FAILURE_WINDOW_MS + 1)
        expect(hasRecentFailure('/users/me')).toBe(false)
    })

    // A poll that keeps failing must not slide the window forward on every
    // attempt, or a continuous outage never gets a second report at all.
    it('expires from the FIRST failure, not the latest retry', () => {
        reportNetworkError('/users/me')
        jest.advanceTimersByTime(FAILURE_WINDOW_MS / 2)
        reportNetworkError('/users/me')
        expect(hasRecentFailure('/users/me')).toBe(true)

        jest.advanceTimersByTime(FAILURE_WINDOW_MS / 2 + 1000)
        expect(hasRecentFailure('/users/me')).toBe(false)
        expect(getRecentFailures()).toBe(0)
    })

    it('reports again immediately after a recovery clears the window', () => {
        reportNetworkError('/users/me')
        clearRecentFailures()
        expect(hasRecentFailure('/users/me')).toBe(false)
    })
})
