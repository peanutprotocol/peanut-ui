/*
 * posthog-js refuses to capture web vitals on any document that is not http(s):
 * `extensions/web-vitals/index.ts` returns false from `isEnabled` on the
 * protocol alone, before it ever consults the remote config. Capacitor serves
 * iOS from `capacitor://localhost` and Android from `https://localhost`, so the
 * entire iOS binary reports no vitals while Android reports normally — 115 iOS
 * pageviews and 0 `$web_vitals` events over the 14 days to 2026-09-04, against
 * ~1.9 vitals per pageview on Android.
 *
 * This covers exactly the documents PostHog opts out of, emitting PostHog's own
 * `$web_vitals` shape so the rows land in the existing series rather than a
 * parallel one. Everything except the protocol gate is deferred to PostHog's
 * own switches, so turning web vitals off server-side turns iOS off too. CLS
 * stays absent on WebKit, which has no Layout Instability API — the same gap
 * the iOS PWA already shows.
 */

import type { Metric } from 'web-vitals'
import posthog from 'posthog-js'

const FLUSH_DELAY_MS = 5000
// Matches PostHog's own ceiling: an LCP over fifteen minutes is a broken clock,
// not a slow page.
const MAX_PLAUSIBLE_VALUE_MS = 15 * 60 * 1000

const WEB_VITALS_ENABLED_SERVER_SIDE = '$web_vitals_enabled_server_side'
const WEB_VITALS_ALLOWED_METRICS = '$web_vitals_allowed_metrics'
const DEFAULT_ALLOWED_METRICS = ['CLS', 'FCP', 'INP', 'LCP']

/** True when posthog-js captures vitals itself and the shim must stay out. */
export function postHogCapturesWebVitals(protocol: string | undefined): boolean {
    return protocol === 'http:' || protocol === 'https:'
}

export type WebVitalsSettings = { enabled: boolean; allowed: string[] }

type Capture = (event: string, properties: Record<string, unknown>) => void

export type WebVitalsReporter = { record: (metric: Metric) => void; flush: () => void }

export function createWebVitalsReporter(options: {
    capture: Capture
    currentUrl: () => string
    /* Read at flush, not at start: remote config lands after init, and the
       observers have to exist before the interactions they measure. */
    settings: () => WebVitalsSettings
}): WebVitalsReporter {
    const { capture, currentUrl, settings } = options
    let buffered: { url: string; metrics: Metric[] } | null = null
    let flushTimer: ReturnType<typeof setTimeout> | undefined

    const flush = (): void => {
        clearTimeout(flushTimer)
        flushTimer = undefined
        const pending = buffered
        buffered = null
        if (!pending?.metrics.length) return

        const { enabled, allowed } = settings()
        if (!enabled) return
        const metrics = pending.metrics.filter((metric) => allowed.includes(metric.name))
        if (!metrics.length) return

        capture('$web_vitals', {
            // The URL the metrics were measured on. PostHog stamps the event
            // with wherever the app is at capture time, so a route change during
            // the flush window would otherwise credit /home's LCP to /send.
            $current_url: pending.url,
            ...pathnameOf(pending.url),
            ...metrics.reduce<Record<string, unknown>>(
                (acc, { name, value, rating, delta, id, navigationType }) => ({
                    ...acc,
                    // `entries` is dropped: PostHog keeps the whole metric here,
                    // but the raw PerformanceEntry list is the bulk of the
                    // payload and nothing reads it.
                    [`$web_vitals_${name}_event`]: { name, value, rating, delta, id, navigationType },
                    [`$web_vitals_${name}_value`]: value,
                }),
                {}
            ),
        })
    }

    const record = (metric: Metric): void => {
        if (metric.value >= MAX_PLAUSIBLE_VALUE_MS) return

        const url = currentUrl()
        // One event per URL, so an SPA route change closes the previous screen's
        // batch instead of mixing two screens' metrics into one row.
        if (buffered && buffered.url !== url) flush()
        if (!buffered) {
            buffered = { url, metrics: [] }
            flushTimer = setTimeout(flush, FLUSH_DELAY_MS)
        }
        buffered.metrics.push(metric)
    }

    return { record, flush }
}

/** Omitted rather than sent as undefined, which would blank PostHog's own value. */
function pathnameOf(url: string): { $pathname?: string } {
    try {
        return { $pathname: new URL(url).pathname }
    } catch {
        return {}
    }
}

/*
 * `capture_performance` is absent from posthog-js's published types in 1.360.0,
 * so the client-side override is read through a local shape rather than left
 * unhonoured — the precedence then matches WebVitalsAutocapture's own: explicit
 * client config first, the persisted remote-config value otherwise.
 */
type PerformanceConfig = boolean | { web_vitals?: boolean; web_vitals_allowed_metrics?: string[] } | undefined

export function postHogWebVitalsSettings(): WebVitalsSettings {
    const performance = (posthog.config as { capture_performance?: PerformanceConfig }).capture_performance
    const clientOptIn = typeof performance === 'object' ? performance?.web_vitals : performance
    const clientAllowed = typeof performance === 'object' ? performance?.web_vitals_allowed_metrics : undefined

    return {
        enabled:
            typeof clientOptIn === 'boolean'
                ? clientOptIn
                : posthog.get_property(WEB_VITALS_ENABLED_SERVER_SIDE) === true,
        allowed:
            clientAllowed ??
            (posthog.get_property(WEB_VITALS_ALLOWED_METRICS) as string[] | undefined) ??
            DEFAULT_ALLOWED_METRICS,
    }
}

let started = false

export function startWebVitalsShim(): void {
    if (started || typeof window === 'undefined') return
    if (postHogCapturesWebVitals(window.location.protocol)) return
    started = true

    const { record, flush } = createWebVitalsReporter({
        capture: (event, properties) => posthog.capture(event, properties),
        currentUrl: () => window.location.href,
        settings: postHogWebVitalsSettings,
    })

    // A metric that arrives as the app goes away would otherwise sit in the
    // buffer until a flush timer the WebView never runs.
    window.addEventListener('pagehide', flush)

    void import('web-vitals')
        .then(({ onCLS, onFCP, onINP, onLCP }) => {
            onCLS(record)
            onFCP(record)
            onINP(record)
            onLCP(record)
        })
        .catch(() => {
            started = false
        })
}
