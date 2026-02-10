// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
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

        // Uncomment the line below to enable Spotlight (https://spotlightjs.com)
        spotlight: false,
    })
}
