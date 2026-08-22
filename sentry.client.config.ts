// This file configures the initialization of Sentry on the client.
// The config you add here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/
//
// NOTE: `NEXT_PUBLIC_SENTRY_DSN` must be scoped to All Environments on Vercel
// (or every env that builds an alias serving traffic — e.g. staging.peanut.me).
// Vercel does NOT auto-rebuild when env-var scope changes, so changing the
// scope without re-triggering a build leaves the DSN undefined in the cached
// bundle and Sentry silently disabled. Burned by this 2026-05-14.

import * as Sentry from '@sentry/nextjs'
import posthog from 'posthog-js'

import { beforeSendHandler } from './sentry.utils'
import { inferSentryEnvironment } from '@/utils/sentry-env'
import { whenIdle } from '@/utils/defer-analytics'

// NEXT_PUBLIC_PERF_BARE builds strip all instrumentation to A/B jank against production.
if (process.env.NODE_ENV !== 'development' && process.env.NEXT_PUBLIC_PERF_BARE !== 'true') {
    /*
     * `Sentry.init` is deferred to the first idle moment. Setting up the SDK —
     * installing the default integrations, patching fetch/XHR and history for
     * BrowserTracing, wrapping console — runs in every session regardless of
     * `tracesSampleRate` (sampling only gates what is SENT), and doing it during
     * page load is a measurable share of the landing page's blocking time.
     *
     * Coverage is unchanged rather than traded away: the two listeners below
     * hold anything thrown before the SDK exists, and it is replayed into Sentry
     * the moment init completes. `whenIdle` also fires on `pagehide`, so a
     * session that ends early still reports.
     */
    const buffered: Array<ErrorEvent | PromiseRejectionEvent> = []
    const bufferEvent = (event: ErrorEvent | PromiseRejectionEvent) => buffered.push(event)

    window.addEventListener('error', bufferEvent)
    window.addEventListener('unhandledrejection', bufferEvent)

    whenIdle(() => {
        window.removeEventListener('error', bufferEvent)
        window.removeEventListener('unhandledrejection', bufferEvent)

        Sentry.init({
            dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
            environment: inferSentryEnvironment(),
            enabled: true,
            tracesSampleRate: 0.1,
            debug: false,

            beforeSend: beforeSendHandler,

            integrations: [
                Sentry.captureConsoleIntegration({
                    levels: ['error', 'warn'],
                }),
                // Cross-link Sentry ↔ PostHog: every Sentry error becomes a `$exception`
                // event in PostHog with a Sentry deeplink, and the Sentry event gets a
                // PostHog tag pointing back at the user's profile + session replay.
                // posthog.init() runs in instrumentation-client.ts; the integration uses
                // the singleton lazily, so init order doesn't matter.
                posthog.sentryIntegration({
                    organization: 'peanut-c34d84c05',
                    projectId: 4505827431415808,
                }),
            ],
        })

        for (const event of buffered) {
            Sentry.captureException(
                'reason' in event ? event.reason : (event.error ?? new Error(event.message || 'Unknown error'))
            )
        }
        buffered.length = 0
    })
}
