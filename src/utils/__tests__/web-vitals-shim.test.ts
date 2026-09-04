/**
 * The shim exists because posthog-js gates web vitals on `location.protocol`
 * being http(s) — which the iOS binary, served from `capacitor://localhost`,
 * never is. These guard the two things that make the shim safe to ship: it
 * stays out of the documents PostHog already covers, and the rows it does emit
 * carry PostHog's own property names so they merge into the existing series.
 */

import { createWebVitalsReporter, postHogCapturesWebVitals, type WebVitalsReporter } from '../web-vitals-shim'
import type { Metric } from 'web-vitals'

const metric = (name: string, value: number): Metric =>
    ({
        name,
        value,
        rating: 'good',
        delta: value,
        id: `v1-${name}`,
        navigationType: 'navigate',
        navigationId: 1,
        entries: [],
    }) as Metric

describe('postHogCapturesWebVitals', () => {
    it.each(['http:', 'https:'])('leaves %s documents to posthog-js', (protocol) => {
        expect(postHogCapturesWebVitals(protocol)).toBe(true)
    })

    // The whole reason the shim exists: iOS Capacitor serves capacitor://, and
    // posthog-js disables web vitals on it before reading any config. Android
    // Capacitor serves https://localhost, which is why only iOS went dark.
    it.each(['capacitor:', 'ionic:', 'file:', undefined])('claims %s documents for the shim', (protocol) => {
        expect(postHogCapturesWebVitals(protocol)).toBe(false)
    })
})

describe('createWebVitalsReporter', () => {
    let capture: jest.Mock
    let url: string
    let reporter: WebVitalsReporter

    beforeEach(() => {
        jest.useFakeTimers()
        capture = jest.fn()
        url = 'capacitor://localhost/home'
        reporter = createWebVitalsReporter(capture, () => url)
    })

    afterEach(() => jest.useRealTimers())

    it('batches a screen’s metrics into one event using posthog’s property names', () => {
        reporter.record(metric('LCP', 2400))
        reporter.record(metric('INP', 180))
        expect(capture).not.toHaveBeenCalled()

        jest.advanceTimersByTime(5000)

        expect(capture).toHaveBeenCalledTimes(1)
        const [event, properties] = capture.mock.calls[0]
        expect(event).toBe('$web_vitals')
        expect(properties).toEqual(expect.objectContaining({ $web_vitals_LCP_value: 2400, $web_vitals_INP_value: 180 }))
        expect(properties.$web_vitals_LCP_event).toEqual(
            expect.objectContaining({ name: 'LCP', value: 2400, rating: 'good' })
        )
    })

    // The raw PerformanceEntry list is the bulk of the payload and nothing reads
    // it — on a WebView that matters more than parity with PostHog's shape.
    it('omits the PerformanceEntry list from the event blob', () => {
        reporter.record(metric('FCP', 900))
        jest.advanceTimersByTime(5000)
        expect(capture.mock.calls[0][1].$web_vitals_FCP_event).not.toHaveProperty('entries')
    })

    // Without this an SPA route change would blend two screens' metrics into one
    // row, and neither screen's number would mean anything.
    it('closes the open batch when the URL changes', () => {
        reporter.record(metric('LCP', 2400))
        url = 'capacitor://localhost/send'
        reporter.record(metric('LCP', 900))

        expect(capture).toHaveBeenCalledTimes(1)
        expect(capture.mock.calls[0][1].$web_vitals_LCP_value).toBe(2400)

        jest.advanceTimersByTime(5000)
        expect(capture).toHaveBeenCalledTimes(2)
        expect(capture.mock.calls[1][1].$web_vitals_LCP_value).toBe(900)
    })

    it('drops implausible values rather than poisoning the percentiles', () => {
        reporter.record(metric('LCP', 15 * 60 * 1000))
        jest.advanceTimersByTime(5000)
        expect(capture).not.toHaveBeenCalled()
    })

    it('sends nothing when no metric arrived', () => {
        reporter.flush()
        expect(capture).not.toHaveBeenCalled()
    })

    // pagehide calls flush directly; a second flush must not re-send the batch.
    it('does not double-send a batch already flushed', () => {
        reporter.record(metric('FCP', 900))
        reporter.flush()
        jest.advanceTimersByTime(5000)
        expect(capture).toHaveBeenCalledTimes(1)
    })
})
