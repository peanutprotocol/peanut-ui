import { redactQrTelemetry } from './qr-telemetry-privacy'
import posthog from 'posthog-js'
import { isExpectedCancellation, isExpectedExceptionChain } from './expected-exception'

import type { ErrorEvent as SentryErrorEvent } from '@sentry/nextjs'

import {
    getEventSearchTexts,
    isPosthogRateLimitNotice,
    isThirdPartyScriptFrame,
    isTransientCapgoNoise,
} from '../../sentry.utils'

type EventProcessor = { processEvent?: (event: SentryErrorEvent) => SentryErrorEvent | null }

/*
 * The PostHog mirror is an integration, so its `processEvent` hook runs during
 * event processing — BEFORE `beforeSend`. Everything `beforeSendHandler` drops
 * has therefore already been copied into PostHog, which is why PostHog's error
 * list is Sentry's noise list.
 *
 * Mostly that is a feature and we leave it alone: PostHog holding what Sentry
 * filters is the only reason the browser-native fetch failures were ever
 * visible. Suppression there is configured server-side (grouping, per-issue
 * rate limit, suppression rules) where it is tunable without a release.
 *
 * The classes worth stopping in the client are injected third-party scripts:
 * nobody can act on them in either tool, and one wallet injector alone billed
 * ~3.7k events. Capgo's transient updater chatter, which is retried on the
 * next launch and only ever means "the CDN hiccuped". And posthog-js's own
 * rate-limit notice, which the mirror would turn into another rate-limited
 * capture and so into another notice, until the session ends. Wrapping rather than
 * filtering inside beforeSend, because beforeSend is downstream of this hook
 * and cannot reach it. Expected passkey cancellations and our already-reported
 * rethrow wrappers also stop here, keeping the original actionable capture.
 */
export function withoutNoise<T extends EventProcessor>(integration: T): T {
    const inner = integration.processEvent?.bind(integration)
    if (!inner) return integration
    return {
        ...integration,
        processEvent: (event: SentryErrorEvent) => {
            const frames = (event.exception?.values ?? []).flatMap((v) => v.stacktrace?.frames ?? [])
            if (frames.some((frame) => isThirdPartyScriptFrame(frame.filename || ''))) return event
            const searchTexts = getEventSearchTexts(event)
            if (isTransientCapgoNoise(searchTexts)) return event
            if (isPosthogRateLimitNotice(searchTexts)) return event
            if (isExpectedExceptionChain(event.exception?.values ?? []) || isExpectedCancellation(event.message)) {
                return event
            }
            return inner(redactQrTelemetry(event))
        },
    }
}

/**
 * Cross-link Sentry ↔ PostHog: every Sentry error becomes a `$exception` event
 * in PostHog with a Sentry deeplink, and the Sentry event gets a PostHog tag
 * pointing back at the user's profile + session replay. posthog.init() runs in
 * instrumentation-client.ts; the integration uses the singleton lazily, so
 * init order does not matter. Shared by the web and the native Sentry init.
 */
export function posthogErrorMirror() {
    return withoutNoise(
        posthog.sentryIntegration({
            organization: 'peanut-c34d84c05',
            projectId: 4505827431415808,
        })
    )
}
