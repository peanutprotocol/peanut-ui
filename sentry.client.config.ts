// This file configures the initialization of Sentry on the client.
// The config you add here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs'

/**
 * Patterns to filter out from Sentry reporting.
 * These are generally noise that doesn't require action.
 */
const IGNORED_ERRORS = {
    // User-initiated cancellations (not bugs)
    userRejected: [
        'User rejected',
        'user rejected',
        'User denied',
        'not allowed by the user',
        'User cancelled',
        'user cancelled',
        'Request rejected',
        'AbortError',
        'The operation was aborted',
    ],

    networkIssues: ['Network Error', 'Failed to fetch', 'Load failed'],

    // Browser/extension noise
    browserNoise: [
        'ResizeObserver loop',
        'ResizeObserver loop limit exceeded',
        'Script error.',
        // Extension interference
        'chrome-extension://',
        'moz-extension://',
        'safari-extension://',
    ],

    // Third-party scripts we don't control
    thirdParty: ['googletagmanager', 'gtag', 'analytics', 'hotjar', 'clarity', 'intercom', 'crisp'],
}

/**
 * Check if error message matches any ignored pattern
 */
function shouldIgnoreError(event: Sentry.ErrorEvent): boolean {
    const message = event.message || ''
    const exceptionValue = event.exception?.values?.[0]?.value || ''
    const exceptionType = event.exception?.values?.[0]?.type || ''
    const culprit = (event as any).culprit || ''

    const searchText = `${message} ${exceptionValue} ${exceptionType} ${culprit}`.toLowerCase()

    // Check all ignore patterns
    for (const patterns of Object.values(IGNORED_ERRORS)) {
        for (const pattern of patterns) {
            if (searchText.includes(pattern.toLowerCase())) {
                return true
            }
        }
    }

    // Ignore errors from browser extensions
    const frames = event.exception?.values?.[0]?.stacktrace?.frames || []
    for (const frame of frames) {
        const filename = frame.filename || ''
        if (
            filename.includes('chrome-extension://') ||
            filename.includes('moz-extension://') ||
            filename.includes('safari-extension://')
        ) {
            return true
        }
    }

    return false
}

if (process.env.NODE_ENV !== 'development') {
    Sentry.init({
        dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
        enabled: true,
        tracesSampleRate: 1,
        debug: false,

        beforeSend(event) {
            // Filter out noise
            if (shouldIgnoreError(event)) {
                return null
            }

            // Clean sensitive headers from client-side events
            if (event.request?.headers) {
                delete event.request.headers['Authorization']
                delete event.request.headers['api-key']
                delete event.request.headers['cookie']
            }

            return event
        },

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
