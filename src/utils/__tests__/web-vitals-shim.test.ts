/**
 * The shim exists because posthog-js gates web vitals on `location.protocol`
 * being http(s) — which the iOS binary, served from `capacitor://localhost`,
 * never is. These guard the three things that make it safe to ship: it stays
 * out of the documents PostHog already covers, it obeys PostHog's own
 * enablement rather than only the protocol, and the rows it emits carry
 * PostHog's property names and the URL they were actually measured on.
 */

import {
    createWebVitalsReporter,
    postHogCapturesWebVitals,
    postHogWebVitalsSettings,
    type WebVitalsReporter,
    type WebVitalsSettings,
} from '../web-vitals-shim'
import type { Metric } from 'web-vitals'
import posthog from 'posthog-js'

jest.mock('posthog-js', () => ({
    __esModule: true,
    default: { config: {}, get_property: jest.fn() },
}))

const mockGetProperty = posthog.get_property as jest.Mock

const metric = (name: string, value: number, navigationURL?: string): Metric =>
    ({
        name,
        value,
        rating: 'good',
        delta: value,
        id: `v1-${name}`,
        navigationType: 'navigate',
        navigationId: 1,
        navigationURL,
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

describe('postHogWebVitalsSettings', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        posthog.config = {} as typeof posthog.config
    })

    // Turning web vitals off server-side has to stop iOS too, or the switch
    // silently only applies to the http(s) clients.
    it('follows the persisted remote-config flag', () => {
        mockGetProperty.mockImplementation((key: string) => key === '$web_vitals_enabled_server_side')
        expect(postHogWebVitalsSettings().enabled).toBe(true)

        mockGetProperty.mockReturnValue(undefined)
        expect(postHogWebVitalsSettings().enabled).toBe(false)
    })

    it('lets explicit client config outrank the remote flag, as PostHog does', () => {
        mockGetProperty.mockImplementation((key: string) => key === '$web_vitals_enabled_server_side')
        posthog.config = { capture_performance: { web_vitals: false } } as unknown as typeof posthog.config
        expect(postHogWebVitalsSettings().enabled).toBe(false)
    })

    it('honours a configured metric allowlist, falling back to all four', () => {
        mockGetProperty.mockImplementation((key: string) =>
            key === '$web_vitals_allowed_metrics' ? ['LCP'] : undefined
        )
        expect(postHogWebVitalsSettings().allowed).toEqual(['LCP'])

        mockGetProperty.mockReturnValue(undefined)
        expect(postHogWebVitalsSettings().allowed).toEqual(['CLS', 'FCP', 'INP', 'LCP'])
    })
})

describe('createWebVitalsReporter', () => {
    let capture: jest.Mock
    let url: string
    let settings: WebVitalsSettings
    let reporter: WebVitalsReporter

    beforeEach(() => {
        jest.useFakeTimers()
        capture = jest.fn()
        url = 'capacitor://localhost/home'
        settings = { enabled: true, allowed: ['CLS', 'FCP', 'INP', 'LCP'] }
        reporter = createWebVitalsReporter({ capture, currentUrl: () => url, settings: () => settings })
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

    /*
     * A route change alone does not flush — only a later metric or the timer
     * does. PostHog stamps the event with wherever the app is at capture time,
     * so without carrying the batch's own URL, /home's LCP is filed under /send.
     */
    it('attributes a batch to the screen it was measured on, not the one navigated to', () => {
        reporter.record(metric('LCP', 2400))
        url = 'capacitor://localhost/send'
        jest.advanceTimersByTime(5000)

        expect(capture.mock.calls[0][1]).toEqual(
            expect.objectContaining({ $current_url: 'capacitor://localhost/home', $pathname: '/home' })
        )
    })

    /*
     * LCP and INP are reported well after the navigation they belong to, so on a
     * soft navigation the callback fires when location.href already names the
     * next screen. web-vitals carries the navigation the metric actually
     * belongs to; reading location at callback time misfiles it.
     */
    it('uses the metric’s own navigation URL when the app has already moved on', () => {
        url = 'capacitor://localhost/send'
        reporter.record(metric('LCP', 2400, 'capacitor://localhost/home'))
        jest.advanceTimersByTime(5000)

        const [, properties] = capture.mock.calls[0]
        expect(properties).toEqual(
            expect.objectContaining({ $current_url: 'capacitor://localhost/home', $pathname: '/home' })
        )
        expect(properties.$web_vitals_LCP_event).toEqual(
            expect.objectContaining({ navigationURL: 'capacitor://localhost/home' })
        )
    })

    it('sends nothing while PostHog has web vitals switched off', () => {
        settings = { enabled: false, allowed: ['CLS', 'FCP', 'INP', 'LCP'] }
        reporter.record(metric('LCP', 2400))
        jest.advanceTimersByTime(5000)
        expect(capture).not.toHaveBeenCalled()
    })

    it('drops metrics outside the configured allowlist', () => {
        settings = { enabled: true, allowed: ['LCP'] }
        reporter.record(metric('LCP', 2400))
        reporter.record(metric('INP', 180))
        jest.advanceTimersByTime(5000)

        const [, properties] = capture.mock.calls[0]
        expect(properties).toHaveProperty('$web_vitals_LCP_value')
        expect(properties).not.toHaveProperty('$web_vitals_INP_value')
    })

    it('sends no event at all when the allowlist excludes everything buffered', () => {
        settings = { enabled: true, allowed: ['CLS'] }
        reporter.record(metric('LCP', 2400))
        jest.advanceTimersByTime(5000)
        expect(capture).not.toHaveBeenCalled()
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
