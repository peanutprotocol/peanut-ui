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

if (process.env.NODE_ENV !== 'development') {
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

        // Session replay settings
        replaysOnErrorSampleRate: 1.0,
        replaysSessionSampleRate: 0.1,
    })
}
