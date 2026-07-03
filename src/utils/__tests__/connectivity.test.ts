import {
    getConsecutiveFailures,
    reportNetworkError,
    reportNetworkOk,
    subscribeConnectivity,
} from '../connectivity'

// Module state is shared across tests, so reset to a known-good state each time.
beforeEach(() => {
    reportNetworkOk()
})

describe('connectivity', () => {
    it('counts consecutive failures and resets on a success', () => {
        expect(getConsecutiveFailures()).toBe(0)

        reportNetworkError()
        reportNetworkError()
        expect(getConsecutiveFailures()).toBe(2)

        reportNetworkOk()
        expect(getConsecutiveFailures()).toBe(0)
    })

    it('notifies subscribers on failure and on recovery', () => {
        const seen: number[] = []
        const unsubscribe = subscribeConnectivity(() => seen.push(getConsecutiveFailures()))

        reportNetworkError()
        reportNetworkError()
        reportNetworkOk()

        expect(seen).toEqual([1, 2, 0])
        unsubscribe()
    })

    it('does not emit a redundant reset when already healthy', () => {
        const unsubscribe = subscribeConnectivity(() => {
            throw new Error('should not be called when already at 0 failures')
        })

        expect(() => reportNetworkOk()).not.toThrow()
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
