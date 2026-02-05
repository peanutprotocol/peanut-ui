// Shared Sentry utilities for filtering noise across all configs
// Used by: sentry.client.config.ts, sentry.edge.config.ts, sentry.server.config.ts

import type { ErrorEvent } from '@sentry/nextjs'

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
    perks: ['This payment is not eligible for a perk'],

    networkIssues: ['Network Error', 'Failed to fetch', 'Load failed'],

    // Browser/extension noise (mostly client-side, but included for consistency)
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
export function shouldIgnoreError(event: ErrorEvent): boolean {
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

    // Ignore errors from browser extensions (client-side only, but safe to check everywhere)
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

/**
 * Clean sensitive headers from events
 */
export function cleanSensitiveHeaders(event: ErrorEvent): void {
    if (event.request?.headers) {
        delete event.request.headers['Authorization']
        delete event.request.headers['api-key']
        delete event.request.headers['cookie']
    }
}

/**
 * Standard beforeSend handler for all Sentry configs
 */
export function beforeSendHandler(event: ErrorEvent): ErrorEvent | null {
    if (shouldIgnoreError(event)) {
        return null
    }
    cleanSensitiveHeaders(event)
    return event
}
