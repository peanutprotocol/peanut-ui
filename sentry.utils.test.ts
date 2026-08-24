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

// Sentry orders `exception.values` root-cause-first, so a wrapper carrying a
// `cause` lands at the end of the array — where the old values[0]-only lookup
// never saw it.
function chainedEvent(values: Array<{ type: string; value: string }>): ErrorEvent {
    return { exception: { values } } as unknown as ErrorEvent
}

describe('shouldIgnoreError — chained exceptions', () => {
    it('ignores a wrapper that is not the first value (the real PEANUT-UI-SNP shape)', () => {
        const event = chainedEvent([
            { type: 'Error', value: 'Request to https://api.peanut.me/bridge/exchange-rate timed out after 20000ms' },
            { type: 'ServiceUnavailableError', value: 'Service temporarily unavailable. Please try again.' },
        ])
        expect(shouldIgnoreError(event)).toBe(true)
    })

    it('ignores a ConnectionTimeoutError wrapper behind its cause', () => {
        const event = chainedEvent([
            { type: 'Error', value: 'aborted' },
            { type: 'ConnectionTimeoutError', value: 'Peanut is taking too long to respond' },
        ])
        expect(shouldIgnoreError(event)).toBe(true)
    })

    it('still reports a chain with no ignorable link', () => {
        const event = chainedEvent([
            { type: 'RangeError', value: 'invalid array length' },
            { type: 'CardIssuanceError', value: 'could not issue card' },
        ])
        expect(shouldIgnoreError(event)).toBe(false)
    })

    it('finds extension frames outside the first value', () => {
        const event = {
            exception: {
                values: [
                    { type: 'Error', value: 'inner' },
                    {
                        type: 'TypeError',
                        value: 'outer',
                        stacktrace: { frames: [{ filename: 'chrome-extension://abc/content.js' }] },
                    },
                ],
            },
        } as unknown as ErrorEvent
        expect(shouldIgnoreError(event)).toBe(true)
    })
})

describe('shouldIgnoreError — Capgo updater noise', () => {
    it.each([
        '[CapgoUpdater] 🔴 Failed to send stats batch',
        '[CapgoUpdater] 🔴 Error waiting for download',
        '[CapgoUpdater] 🔴 Download error: unexpected end of stream',
        '🔴 ✨  CapgoUpdater : Semaphore wait timed out after 15000ms',
        '[capgo] update check failed: network_error',
    ])('ignores transient updater failure: %s', (message) => {
        expect(shouldIgnoreError(eventWith({ message }))).toBe(true)
    })

    it('keeps disable_auto_update_under_native — OTA is dead for that binary', () => {
        expect(
            shouldIgnoreError(eventWith({ message: '[capgo] update check failed: disable_auto_update_under_native' }))
        ).toBe(false)
    })

    it('keeps disable_auto_update_under_native from the plugin channel too', () => {
        const message =
            '[CapgoUpdater] 🔴 getLatest failed with error: disable_auto_update_under_native, message: Cannot revert under native version'
        expect(shouldIgnoreError(eventWith({ message }))).toBe(false)
    })

    it('keeps a checksum mismatch — the bundle arrived corrupt, not merely late', () => {
        expect(shouldIgnoreError(eventWith({ message: '[CapgoUpdater] 🔴 Checksum mismatch' }))).toBe(false)
    })

    it('does not touch non-Capgo errors that mention a download', () => {
        expect(shouldIgnoreError(eventWith({ type: 'Error', value: 'Download error: statement failed' }))).toBe(false)
    })
})

describe('shouldIgnoreError — passkey wrapper', () => {
    it('ignores the curated PasskeyError wrapper (useZeroDev already reported the raw failure)', () => {
        const event = eventWith({
            type: 'PasskeyError',
            value: 'We couldn’t verify your passkey. Please try again, or contact support if it keeps happening.',
        })
        expect(shouldIgnoreError(event)).toBe(true)
    })

    it('still reports the underlying WebAuthn failure', () => {
        expect(shouldIgnoreError(eventWith({ type: 'NotReadableError', value: 'passkey prompt interrupted' }))).toBe(
            false
        )
    })
    it('does not widen fuzzy message matching to a wrapped cause', () => {
        // Only exception TYPES are scanned chain-wide. A wrapper whose message
        // happens to contain a noise pattern must still be reported — widening
        // that is exactly what ate real payment failures in 5343f1d0.
        const event = chainedEvent([
            { type: 'PaymentError', value: 'charge could not be created' },
            { type: 'SendFailedError', value: 'Details: Failed to fetch' },
        ])
        expect(shouldIgnoreError(event)).toBe(false)
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
