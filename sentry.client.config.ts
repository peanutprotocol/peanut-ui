// This file configures the initialization of Sentry on the client.
// The config you add here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs'

import { beforeSendHandler } from './sentry.utils'

if (process.env.NODE_ENV !== 'development') {
    Sentry.init({
        dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
        enabled: true,
        tracesSampleRate: 1,
        debug: false,

        beforeSend: beforeSendHandler,

        integrations: [
            Sentry.captureConsoleIntegration({
                levels: ['error', 'warn'],
            }),
        ],

        // Session replay settings
        replaysOnErrorSampleRate: 1.0,
        replaysSessionSampleRate: 0.1,
    })
}
