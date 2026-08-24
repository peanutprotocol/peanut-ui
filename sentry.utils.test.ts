import type { ErrorEvent } from '@sentry/nextjs'
import { beforeSendHandler, shouldIgnoreError } from './sentry.utils'
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

describe('beforeSendHandler — OneSignal op-failure fingerprint', () => {
    const opEvent = (message: string): ErrorEvent => ({ message }) as unknown as ErrorEvent

    it('collapses per-device op failures onto one fingerprint', () => {
        const a = opEvent('Op failed (no retry): [{"name":"update-subscription","onesignalId":"5b1ff00c"}]')
        const b = opEvent('Op failed (no retry): [{"name":"update-subscription","onesignalId":"e064b640"}]')

        beforeSendHandler(a)
        beforeSendHandler(b)

        expect(a.fingerprint).toEqual(['onesignal-op-failed', 'update-subscription'])
        expect(a.fingerprint).toEqual(b.fingerprint)
    })

    it('keeps different op names apart', () => {
        const paused = opEvent('Op failed, pausing: [{"name":"login-user","onesignalId":"576b81d2"}]')
        beforeSendHandler(paused)
        expect(paused.fingerprint).toEqual(['onesignal-op-failed', 'login-user'])
    })

    it('leaves unrelated events unfingerprinted', () => {
        const other = opEvent('Something else failed entirely')
        beforeSendHandler(other)
        expect(other.fingerprint).toBeUndefined()
    })
})

describe('shouldIgnoreError — OneSignal worker-messenger noise', () => {
    it('ignores the no-service-worker postMessage warning', () => {
        expect(shouldIgnoreError(eventWith({ message: '[WM] No SW registration for postMessage' }))).toBe(true)
    })
})
