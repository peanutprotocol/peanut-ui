import posthog from 'posthog-js'
import * as Sentry from '@sentry/nextjs'
import { beforeSendHandler } from './sentry.utils'
import { inferSentryEnvironment } from '@/utils/sentry-env'
import { getIOSMajorVersion } from '@/utils/webkit.utils'

// rrweb session replay serializes the DOM on every mutation — too heavy for low-end
// WebViews. iOS WebKit has no deviceMemory, so gate on OS version there: iOS 17
// requires A12+, which handles rrweb fine; anything stuck below is A11 or older.
// On Android, deviceMemory (GB) is Chromium-only and often absent on cheap devices;
// treat "unknown" as low-end and skip, to protect the weakest ones.
function nativeReplayEnabled(): boolean {
    if (typeof navigator === 'undefined') return false
    const iosVersion = getIOSMajorVersion()
    if (iosVersion !== null) return iosVersion >= 17
    const nav = navigator as Navigator & { deviceMemory?: number }
    return (nav.deviceMemory ?? 0) >= 4 && (nav.hardwareConcurrency ?? 0) >= 6
}

if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'development') {
    const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://eu.i.posthog.com'
    const isNativeBuild = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === 'true'

    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
        // Web posts through the `/relay` Next.js rewrite — the path is intentionally
        // innocuous (`/ingest/` was on uBlock Origin's blocklist as a known PostHog
        // signature, and blocked-client retries flooded the console). The Capacitor
        // static export has no rewrite layer, so it posts to the absolute host.
        api_host: isNativeBuild ? posthogHost : '/relay',
        ui_host: posthogHost,
        person_profiles: 'identified_only',
        capture_pageview: true,
        capture_pageleave: true,
        autocapture: true,
        // Leave replay sampling to the PostHog project settings (unchanged). Only extra
        // gate: on native, skip low-end WebViews where rrweb serialization causes jank.
        disable_session_recording: isNativeBuild && !nativeReplayEnabled(),
    })

    // The web build inits Sentry via sentry.client.config.ts (injected by
    // withSentryConfig) with tunnelRoute '/monitoring'. The Capacitor static
    // export runs neither withSentryConfig nor a server for that tunnel, so
    // without this it reports nothing — init here and post straight to the DSN.
    if (isNativeBuild && process.env.NEXT_PUBLIC_SENTRY_DSN) {
        Sentry.init({
            dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
            environment: inferSentryEnvironment(),
            release: process.env.NEXT_PUBLIC_GIT_COMMIT_HASH,
            // Native traffic is a small fraction of web, and onboarding bugs here
            // are hard to reproduce — capture everything. Errors are 100% by
            // default (sampleRate stated explicitly for intent); traces at 100%
            // vs the web's 0.1; and mirror web by also capturing console.warn.
            sampleRate: 1.0,
            tracesSampleRate: 1.0,
            beforeSend: beforeSendHandler,
            integrations: [Sentry.captureConsoleIntegration({ levels: ['error', 'warn'] })],
        })
    }

    // Brave identifies as Chrome in User-Agent — detect it and set a person property
    // so we can accurately measure our crypto-native Brave audience in PostHog
    if (navigator.brave) {
        navigator.brave.isBrave().then((isBrave) => {
            if (isBrave) {
                posthog.setPersonProperties({ browser_override: 'Brave' })
            }
        })
    }
}
