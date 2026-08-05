import posthog from 'posthog-js'
import * as Sentry from '@sentry/nextjs'
import { beforeSendHandler } from './sentry.utils'
import { inferSentryEnvironment } from '@/utils/sentry-env'
import { withoutBrowserTracing } from '@/utils/sentry-integrations'

// NEXT_PUBLIC_PERF_BARE builds strip all instrumentation to A/B jank against production.
const PERF_BARE = process.env.NEXT_PUBLIC_PERF_BARE === 'true'

if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'development' && !PERF_BARE) {
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
        // autocapture walks the DOM ancestor chain on every tap and rrweb serializes
        // the DOM on every mutation — both cost frames inside the in-app WebView
        // renderer, so native builds keep only explicit posthog.capture events.
        // Web/PWA (Chrome's own renderer) keeps both.
        autocapture: !isNativeBuild,
        disable_session_recording: isNativeBuild,
    })

    // The web build inits Sentry via sentry.client.config.ts (injected by
    // withSentryConfig) with tunnelRoute '/monitoring'. The Capacitor static
    // export runs neither withSentryConfig nor a server for that tunnel, so
    // without this it reports nothing — init here and post straight to the DSN.
    if (isNativeBuild && process.env.NEXT_PUBLIC_SENTRY_DSN) {
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
            beforeSend: beforeSendHandler,
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
