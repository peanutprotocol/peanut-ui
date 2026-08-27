import posthog from 'posthog-js'
import { beforeSendHandler } from './sentry.utils'
import { inferSentryEnvironment } from '@/utils/sentry-env'
import { withoutBrowserTracing } from '@/utils/sentry-integrations'
import { whenIdle } from '@/utils/defer-analytics'
import { installPaymentNetworkGoogleAnalyticsGuard, isPaymentNetworkExplorerPath } from '@/utils/private-routes'

// Same conditions as the GA bootstrap in app/layout.tsx: with no GA to disable
// there is nothing to guard, and PERF_BARE builds exist to carry no instrumentation.
if (
    process.env.NODE_ENV !== 'development' &&
    process.env.NEXT_PUBLIC_GA_KEY &&
    process.env.NEXT_PUBLIC_CAPACITOR_BUILD !== 'true' &&
    process.env.NEXT_PUBLIC_PERF_BARE !== 'true'
) {
    installPaymentNetworkGoogleAnalyticsGuard()
}

// NEXT_PUBLIC_PERF_BARE builds strip all instrumentation to A/B jank against production.
const PERF_BARE = process.env.NEXT_PUBLIC_PERF_BARE === 'true'

if (
    typeof window !== 'undefined' &&
    process.env.NODE_ENV !== 'development' &&
    !PERF_BARE &&
    !isPaymentNetworkExplorerPath(window.location.pathname)
) {
    const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://eu.i.posthog.com'
    const isNativeBuild = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === 'true'

    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
        // Web posts through the `/relay` Next.js rewrite — the path is intentionally
        // innocuous (`/ingest/` was on uBlock Origin's blocklist as a known PostHog
        // signature, and blocked-client retries flooded the console). The Capacitor
        // static export has no rewrite layer, so it posts to the absolute host.
        api_host: isNativeBuild ? posthogHost : '/relay',
        ui_host: posthogHost,
        person_profiles: 'identified_only',
        capture_pageview: true,
        capture_pageleave: true,
        // The payment explorer contains team-only identity and relationship data.
        // Drop every event on client navigation; direct loads skip init above.
        before_send: (event) => (isPaymentNetworkExplorerPath(window.location.pathname) ? null : event),
        // autocapture walks the DOM ancestor chain on every tap, which costs frames
        // in the in-app WebView renderer for data that 220+ explicit
        // posthog.capture calls already cover. Native keeps the explicit events only.
        autocapture: !isNativeBuild,
        /*
         * Session recording is ON everywhere, native included, as a deliberate
         * trial from 1.0.48.
         *
         * It starts at `whenIdle` rather than at init: rrweb's recorder is a
         * separate ~183 KB script whose load and first full-DOM snapshot landed
         * in the middle of page load, and on the landing page that is the single
         * largest blocking cost after the framework itself. Recording still
         * covers every session — it begins a beat later, so the opening moment
         * of a replay is not captured.
         *
         * It was disabled on native in 1.0.45 on the theory that rrweb's
         * per-mutation DOM serialization was the jank users reported. That was
         * never isolated: 1.0.45 also made pull-to-refresh listeners passive
         * (the whole app's touch handling), dropped Sentry BrowserTracing and
         * the data-sentry-* DOM annotations, and moved confetti off the main
         * thread — so the improvement has at least four candidate causes and
         * replay may not be the main one.
         *
         * Since then the amplifier that made rrweb worst on native is gone:
         * useStaleDeploymentReload now bounds the document to 12h, so the node
         * mirror and event buffers no longer grow across a document that lived
         * for days. If this build does regress, full_snapshot_interval_millis
         * (default 5 minutes of full-DOM re-serialization) is the first knob to
         * reach for, before switching recording off again.
         */
        disable_session_recording: true,
    })

    whenIdle(() => posthog.startSessionRecording())

    // expose the instance like the official snippet does — console access for
    // QA (feature-flag overrides, e.g. pwa-sunset preview testing) and support
    // debugging; the npm bundle doesn't attach it by itself
    ;(window as Window & { posthog?: typeof posthog }).posthog = posthog

    // The web build inits Sentry via sentry.client.config.ts (injected by
    // withSentryConfig) with tunnelRoute '/monitoring'. The Capacitor static
    // export runs neither withSentryConfig nor a server for that tunnel, so
    // without this it reports nothing — init here and post straight to the DSN.
    if (isNativeBuild && process.env.NEXT_PUBLIC_SENTRY_DSN) {
        /*
         * Imported here rather than at module scope: this file is loaded on every
         * page, and a static import put the ~440 KB SDK in the web bundle too —
         * where it was parsed and evaluated (~1.7s of CPU on the landing page)
         * for a branch that only ever runs in the Capacitor build.
         */
        void import('@sentry/nextjs').then((Sentry) => {
            Sentry.init({
                dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
                environment: inferSentryEnvironment(),
                release: process.env.NEXT_PUBLIC_GIT_COMMIT_HASH,
                // Errors captured at 100%; tracing fully off on native — BrowserTracing
                // wraps fetch/XHR, patches history and runs PerformanceObservers in every
                // session regardless of tracesSampleRate (sampling only gates sending),
                // and that instrumentation overhead is visible jank in the WebView.
                sampleRate: 1.0,
                tracesSampleRate: 0,
                beforeSend: (event) =>
                    isPaymentNetworkExplorerPath(window.location.pathname) ? null : beforeSendHandler(event),
                // A WebView that can't reach the bundler can't reach ingest either,
                // so the report of the failure died with the session. The offline
                // transport parks undeliverable envelopes in IndexedDB and flushes
                // them on a later launch — the failures worth reading are exactly
                // the ones that happen while the network is misbehaving.
                transport: Sentry.makeBrowserOfflineTransport(Sentry.makeFetchTransport),
                integrations: (defaults) => [
                    ...withoutBrowserTracing(defaults),
                    Sentry.captureConsoleIntegration({ levels: ['error'] }),
                ],
            })

            /*
             * `release` above is the JS bundle's commit — with OTA updates it can differ
             * from the installed binary, which made PEANUT-UI-R5F look like it came from
             * a build it didn't. Tag the binary identity on every event so the skew is
             * always visible; swControlled flags a stale pre-2026-04 service worker
             * still intercepting requests inside the WebView.
             */
            Sentry.setTag('swControlled', String(!!navigator.serviceWorker?.controller))
            import('@capacitor/app')
                .then(({ App }) => App.getInfo())
                .then((info) => {
                    Sentry.setTag('binaryVersion', info.version)
                    Sentry.setTag('binaryBuild', info.build)
                })
                .catch(() => {})
        })
    }

    // Brave identifies as Chrome in User-Agent — detect it and set a person property
    // so we can accurately measure our crypto-native Brave audience in PostHog
    if (navigator.brave) {
        navigator.brave.isBrave().then((isBrave) => {
            if (isBrave) {
                posthog.setPersonProperties({ browser_override: 'Brave' })
            }
        })
    }
}
