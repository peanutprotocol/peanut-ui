import * as Sentry from '@sentry/nextjs'
import { CaptureConsole } from '@sentry/integrations'

Sentry.init({
    dsn: process.env.SENTRY_DSN,
    integrations: [
        new CaptureConsole({
            levels: ['error'],
        }),
    ],
    // Set tracesSampleRate to 1.0 to capture 100%
    // of transactions for performance monitoring.
    // We recommend adjusting this value in production
    tracesSampleRate: 1.0,

    // ...

    // Note: if you want to override the automatic release value, do not set a
    // `release` value here - use the environment variable `SENTRY_RELEASE`, so
    // that it will also get attached to your source maps
})
