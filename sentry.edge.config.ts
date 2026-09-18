// This file configures the initialization of Sentry for edge features (middleware, edge routes, and so on).
// The config you add here will be used whenever one of the edge features is loaded.
// Note that this config is unrelated to the Vercel Edge Runtime and is also required when running locally.
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
        tracesSampleRate: 1,
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
    })
}
