// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs'

import { beforeSendRouteAwareHandler, beforeSendRouteAwareTransaction } from './sentry.utils'
import { inferSentryEnvironment, isSentryReportingEnvironment } from '@/utils/sentry-env'

// Skipped outside production / staging / native: an ad-hoc PR preview reported
// into the same project as production, where nobody triaged it.
if (isSentryReportingEnvironment()) {
    Sentry.init({
        dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
        environment: inferSentryEnvironment(),
        enabled: true,
        // Matches the client. Full server tracing bought no insight nobody
        // could get from 10% of it, and every span is a billed event.
        tracesSampleRate: 0.1,
        debug: false,

        beforeSend: beforeSendRouteAwareHandler,
        beforeSendTransaction: beforeSendRouteAwareTransaction,

        integrations: [
            // `error` only — a console.warn costs the same as an exception, and
            // the warn-level output of this app is handled conditions, not defects.
            Sentry.captureConsoleIntegration({
                levels: ['error'],
            }),
        ],

        // Uncomment the line below to enable Spotlight (https://spotlightjs.com)
        spotlight: false,
    })
}
