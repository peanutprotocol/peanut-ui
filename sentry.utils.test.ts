import type { ErrorEvent } from '@sentry/nextjs'
import { shouldIgnoreError } from './sentry.utils'
import { criticalFlowTags } from '@/utils/sentry-critical-flow'

function eventWith(partial: {
    message?: string
    type?: string
    value?: string
    tags?: Record<string, string>
}): ErrorEvent {
    return {
        message: partial.message,
        tags: partial.tags,
        exception: { values: [{ type: partial.type, value: partial.value }] },
    } as unknown as ErrorEvent
}

describe('shouldIgnoreError — alreadyReported (fetchWithSentry wrapper)', () => {
    it('ignores a re-thrown ServiceUnavailableError (already captured at the fetch site)', () => {
        expect(shouldIgnoreError(eventWith({ type: 'ServiceUnavailableError', value: 'upstream 503' }))).toBe(true)
    })

    it('ignores a re-thrown ConnectionTimeoutError (already captured at the fetch site)', () => {
        expect(shouldIgnoreError(eventWith({ type: 'ConnectionTimeoutError', value: 'timed out' }))).toBe(true)
    })

    it('does not ignore an unrelated application error', () => {
        expect(shouldIgnoreError(eventWith({ type: 'TypeError', value: 'x is not a function' }))).toBe(false)
    })
})

describe('shouldIgnoreError — critical-flow captures', () => {
    const tags = criticalFlowTags('direct-send')

    it('ignores a network failure with no critical-flow tag', () => {
        expect(shouldIgnoreError(eventWith({ type: 'HttpRequestError', value: 'Details: Failed to fetch' }))).toBe(true)
    })

    it('keeps the same failure when captured from a money-moving flow', () => {
        expect(
            shouldIgnoreError(eventWith({ type: 'HttpRequestError', value: 'Details: Failed to fetch', tags }))
        ).toBe(false)
    })

    it('keeps a wrapped ServiceUnavailableError from a money-moving flow', () => {
        expect(shouldIgnoreError(eventWith({ type: 'ServiceUnavailableError', value: 'upstream 503', tags }))).toBe(
            false
        )
    })

    it('still ignores user cancellations, tagged or not', () => {
        expect(shouldIgnoreError(eventWith({ type: 'Error', value: 'User rejected the request', tags }))).toBe(true)
    })
})
