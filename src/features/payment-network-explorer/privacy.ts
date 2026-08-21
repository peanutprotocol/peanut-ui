'use client'

import * as Sentry from '@sentry/nextjs'
import posthog from 'posthog-js'
import { disablePaymentNetworkGoogleAnalytics, isPaymentNetworkExplorerPath } from './privacy-route'

type StoppableReplay = { stop?: () => Promise<void> }

let suppressed = false

/**
 * Stop analytics and replay before the explorer renders or fetches sensitive data.
 * A full reload is required to resume telemetry after this route.
 */
export function suppressPaymentNetworkTelemetry(
    pathname = typeof window === 'undefined' ? '' : window.location.pathname
) {
    if (suppressed || !isPaymentNetworkExplorerPath(pathname)) return
    suppressed = true
    disablePaymentNetworkGoogleAnalytics(pathname)

    try {
        posthog.stopSessionRecording()
        posthog.set_config({
            autocapture: false,
            capture_pageview: false,
            capture_pageleave: false,
            disable_session_recording: true,
        })
    } catch {}

    try {
        const client = Sentry.getClient()
        const replay = client?.getIntegrationByName('Replay') as StoppableReplay | undefined
        void replay?.stop?.().catch(() => undefined)
        void client?.close(0)
    } catch {}
}

export function resetPaymentNetworkTelemetryGuardForTest(): void {
    suppressed = false
}
