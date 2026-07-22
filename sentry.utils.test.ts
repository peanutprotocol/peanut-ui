import type { ErrorEvent } from '@sentry/nextjs'
import { shouldIgnoreError } from './sentry.utils'

function eventWith(partial: { message?: string; type?: string; value?: string }): ErrorEvent {
    return {
        message: partial.message,
        exception: { values: [{ type: partial.type, value: partial.value }] },
    } as unknown as ErrorEvent
}

describe('shouldIgnoreError — alreadyReported (fetchWithSentry wrapper)', () => {
    it('ignores a re-thrown ServiceUnavailableError (already captured at the fetch site)', () => {
        expect(shouldIgnoreError(eventWith({ type: 'ServiceUnavailableError', value: 'upstream 503' }))).toBe(true)
    })

    it('does not ignore an unrelated application error', () => {
        expect(shouldIgnoreError(eventWith({ type: 'TypeError', value: 'x is not a function' }))).toBe(false)
    })
})
