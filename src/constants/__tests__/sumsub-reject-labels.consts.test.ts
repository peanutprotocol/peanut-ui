import { isTerminalRejection } from '../sumsub-reject-labels.consts'

/**
 * The precedence that matters here: an EXPLICIT verdict beats the heuristics.
 *
 * `rejectType` carries a real statement — from the provider, or from our own
 * read-model's `canRetry`. Labels and the failure count are what we fall back
 * on when no such statement exists. Sumsub retains labels from an earlier
 * decision when a later one carries none, so treating them as authoritative
 * denies retries the backend has just authorized (TASK-21882).
 */
describe('isTerminalRejection', () => {
    it('an explicit RETRY wins over stale terminal labels', () => {
        expect(isTerminalRejection({ rejectType: 'RETRY', rejectLabels: ['FORGERY'] })).toBe(false)
        expect(isTerminalRejection({ rejectType: 'PROVIDER_FIXABLE', rejectLabels: ['FORGERY', 'DUPLICATE'] })).toBe(
            false
        )
    })

    it('an explicit RETRY wins over an exhausted failure count', () => {
        expect(isTerminalRejection({ rejectType: 'RETRY', failureCount: 5 })).toBe(false)
    })

    it('an explicit FINAL is still terminal, whatever else is present', () => {
        expect(isTerminalRejection({ rejectType: 'FINAL', rejectLabels: [] })).toBe(true)
        expect(isTerminalRejection({ rejectType: 'PROVIDER_FINAL' })).toBe(true)
    })

    it('falls back to the heuristics when there is no explicit verdict', () => {
        expect(isTerminalRejection({ rejectLabels: ['FORGERY'] })).toBe(true)
        expect(isTerminalRejection({ failureCount: 2 })).toBe(true)
        expect(isTerminalRejection({ rejectType: null, rejectLabels: ['UNSATISFACTORY_PHOTOS'] })).toBe(false)
    })

    it('is not terminal when nothing is known — an unknown state is not a verdict', () => {
        expect(isTerminalRejection({})).toBe(false)
        expect(isTerminalRejection({ rejectType: null, failureCount: undefined, rejectLabels: null })).toBe(false)
    })
})
