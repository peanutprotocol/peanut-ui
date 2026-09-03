import type { ErrorEvent } from '@sentry/nextjs'
import { beforeSendHandler, getEventSearchTexts, isTransientCapgoNoise, shouldIgnoreError } from './sentry.utils'
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

    /*
     * The generic IGNORED_ERRORS loop runs first and returns early, so an
     * actionable failure whose text also trips a fuzzy pattern would be dropped
     * before the Capgo carve-out ever ran. Real Capgo reports `network_error`
     * (snake_case) today, which misses `networkIssues` by luck rather than design
     * — these pin the ordering so a future message shape cannot re-open it.
     */
    it('keeps a corrupt bundle even when the message also trips networkIssues', () => {
        expect(shouldIgnoreError(eventWith({ message: '[CapgoUpdater] 🔴 Checksum mismatch: Network Error' }))).toBe(
            false
        )
    })

    it('keeps an under-native rejection even when the message also trips networkIssues', () => {
        expect(
            shouldIgnoreError(
                eventWith({ message: '[capgo] update check failed: disable_auto_update_under_native, Failed to fetch' })
            )
        ).toBe(false)
    })

    it('still suppresses a transient Capgo failure that trips networkIssues', () => {
        expect(shouldIgnoreError(eventWith({ message: '[CapgoUpdater] 🔴 Download error: Failed to fetch' }))).toBe(
            true
        )
    })

    it('does not touch non-Capgo errors that mention a download', () => {
        expect(shouldIgnoreError(eventWith({ type: 'Error', value: 'Download error: statement failed' }))).toBe(false)
    })

    // Exported for the PostHog mirror wrapper (sentry-init), whose processEvent
    // hook runs before beforeSend and so cannot rely on shouldIgnoreError.
    describe('isTransientCapgoNoise', () => {
        const textsOf = (message: string) => getEventSearchTexts(eventWith({ message }))

        it('is true for a transient updater failure', () => {
            expect(isTransientCapgoNoise(textsOf('[CapgoUpdater] 🔴 Failed to send stats batch'))).toBe(true)
            expect(isTransientCapgoNoise(textsOf('[capgo] update check failed: network_error'))).toBe(true)
        })

        it('is false for the actionable failures shouldIgnoreError keeps', () => {
            expect(isTransientCapgoNoise(textsOf('[CapgoUpdater] 🔴 Checksum mismatch'))).toBe(false)
            expect(
                isTransientCapgoNoise(textsOf('[capgo] update check failed: disable_auto_update_under_native'))
            ).toBe(false)
        })

        it('is false for anything not from Capgo', () => {
            expect(isTransientCapgoNoise(textsOf('Failed to send stats batch'))).toBe(false)
            expect(isTransientCapgoNoise(getEventSearchTexts(eventWith({ type: 'TypeError', value: 'boom' })))).toBe(
                false
            )
        })
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

describe('shouldIgnoreError — fetch-site network captures', () => {
    function fetchSiteCapture(value: string, method = 'POST', kind = 'network-error'): ErrorEvent {
        return {
            fingerprint: [kind, 'https://api.peanut.me/charges', method],
            exception: { values: [{ type: 'TypeError', value }] },
        } as unknown as ErrorEvent
    }

    // Both engine spellings, because the split is per-engine: WebKit says
    // `Load failed`, Chromium (so every Android WebView) says `Failed to fetch`.
    it.each(['Failed to fetch', 'Load failed', 'Network Error'])(
        'keeps a failed mutation for %s — the user lost progress in a money flow',
        (value) => {
            expect(shouldIgnoreError(fetchSiteCapture(value))).toBe(false)
        }
    )

    it.each(['PUT', 'PATCH', 'DELETE', 'post'])('keeps a failed %s', (method) => {
        expect(shouldIgnoreError(fetchSiteCapture('Failed to fetch', method))).toBe(false)
    })

    it('keeps a mutation that timed out (the other fetch-site fingerprint)', () => {
        expect(shouldIgnoreError(fetchSiteCapture('Failed to fetch', 'POST', 'timeout'))).toBe(false)
    })

    /*
     * The timeout capture groups on `['timeout']` alone so one phenomenon is
     * one issue, which leaves no method in the fingerprint. Reading it
     * positionally would make this rescue silently inert for exactly the events
     * it exists to keep — a POST that dies on the network — so the method comes
     * off the tag, with the fingerprint slot kept as a fallback for the
     * positional captures and for events already in flight from an old bundle.
     */
    function taggedTimeout(method: string): ErrorEvent {
        return {
            fingerprint: ['timeout'],
            tags: { 'http.method': method, route: '/charges' },
            exception: { values: [{ type: 'TypeError', value: 'Failed to fetch' }] },
        } as unknown as ErrorEvent
    }

    it.each(['POST', 'PUT', 'PATCH', 'DELETE', 'post'])('keeps a timed-out %s off the http.method tag', (method) => {
        expect(shouldIgnoreError(taggedTimeout(method))).toBe(false)
    })

    it.each(['GET', 'HEAD'])('still ignores a timed-out %s off the tag', (method) => {
        expect(shouldIgnoreError(taggedTimeout(method))).toBe(true)
    })

    // 78% of this population is failed GETs on /home — balance and price polls
    // that retry and succeed. Their rate belongs in PostHog, not as individual
    // Sentry events.
    it.each(['GET', 'HEAD'])('still ignores a failed %s', (method) => {
        expect(shouldIgnoreError(fetchSiteCapture('Failed to fetch', method))).toBe(true)
    })

    it('still ignores the same message without the fetch-site fingerprint', () => {
        expect(shouldIgnoreError(eventWith({ type: 'TypeError', value: 'Failed to fetch' }))).toBe(true)
    })

    it('does not rescue an unrelated fingerprint that merely mentions the network', () => {
        const event = {
            fingerprint: ['onesignal-op-failed', 'update-subscription'],
            exception: { values: [{ type: 'TypeError', value: 'Failed to fetch' }] },
        } as unknown as ErrorEvent
        expect(shouldIgnoreError(event)).toBe(true)
    })
})

describe('shouldIgnoreError — injected third-party scripts', () => {
    function framedEvent(filename: string): ErrorEvent {
        return {
            exception: {
                values: [
                    {
                        type: 'TypeError',
                        value: "Cannot read properties of undefined (reading 'M_ID')",
                        stacktrace: { frames: [{ filename }] },
                    },
                ],
            },
        } as unknown as ErrorEvent
    }

    // The scheme-bearing cases were always caught; `app:///executors/` is the
    // one that forced PEANUT-UI-SNS to be archived by hand.
    it.each([
        'chrome-extension://abcdef/inject.js',
        'moz-extension://abcdef/inject.js',
        'safari-extension://abcdef/inject.js',
        'app:///executors/200.js',
    ])('ignores a frame from %s', (filename) => {
        expect(shouldIgnoreError(framedEvent(filename))).toBe(true)
    })

    it('does not ignore our own bundle, including an unresolved app:/// frame', () => {
        expect(shouldIgnoreError(framedEvent('/_next/static/chunks/main-abc123.js'))).toBe(false)
        expect(shouldIgnoreError(framedEvent('app:///_next/static/chunks/main-abc123.js'))).toBe(false)
    })
})
