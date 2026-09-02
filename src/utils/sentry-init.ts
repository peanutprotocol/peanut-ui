import posthog from 'posthog-js'

import type { ErrorEvent as SentryErrorEvent } from '@sentry/nextjs'

import {
    beforeSendHandler,
    getEventSearchTexts,
    isThirdPartyScriptFrame,
    isTransientCapgoNoise,
} from '../../sentry.utils'
import { inferSentryEnvironment } from '@/utils/sentry-env'
import { loadSentry } from '@/utils/sentry-lazy'
import { isPaymentNetworkExplorerPath } from '@/utils/private-routes'

// NEXT_PUBLIC_PERF_BARE builds strip all instrumentation to A/B jank against production.
// The Capacitor build initialises its own client in instrumentation-client.ts
// (offline transport, no BrowserTracing); a second init here would replace it.
const ENABLED =
    process.env.NODE_ENV !== 'development' &&
    process.env.NEXT_PUBLIC_PERF_BARE !== 'true' &&
    process.env.NEXT_PUBLIC_CAPACITOR_BUILD !== 'true'

/*
 * The SDK is fetched and initialised on demand rather than on every page load.
 *
 * The marketing site does not need error reporting enough to spend ~440 KB and
 * ~2s of CPU on it during load — it is the most expensive script on the landing
 * page. App routes call `initSentry` from AppGlobals, so the SDK arrives as
 * soon as the user is somewhere that wants it, including after a client-side
 * navigation off the landing page.
 *
 * Coverage on marketing routes is not simply dropped: the listeners below hold
 * anything thrown before the SDK exists AND trigger the load themselves, so a
 * landing page that actually errors still reports it. A landing page that
 * doesn't never pays.
 */
const buffered: Array<ErrorEvent | PromiseRejectionEvent> = []
let started = false

function bufferEvent(event: ErrorEvent | PromiseRejectionEvent): void {
    buffered.push(event)
    // something genuinely broke — pull the SDK in now, wherever we are
    initSentry()
}

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
 * Two classes are worth stopping in the client. Injected third-party scripts:
 * nobody can act on them in either tool, and one wallet injector alone billed
 * ~3.7k events. And Capgo's transient updater chatter, which is retried on the
 * next launch and only ever means "the CDN hiccuped". Wrapping rather than
 * filtering inside beforeSend, because beforeSend is downstream of this hook
 * and cannot reach it.
 */
export function withoutNoise<T extends { processEvent?: (event: SentryErrorEvent) => SentryErrorEvent | null }>(
    integration: T
): T {
    const inner = integration.processEvent?.bind(integration)
    if (!inner) return integration
    return {
        ...integration,
        processEvent: (event: SentryErrorEvent) => {
            const frames = (event.exception?.values ?? []).flatMap((v) => v.stacktrace?.frames ?? [])
            if (frames.some((frame) => isThirdPartyScriptFrame(frame.filename || ''))) return event
            if (isTransientCapgoNoise(getEventSearchTexts(event))) return event
            return inner(event)
        },
    }
}

export function initSentry(): void {
    if (!ENABLED || started || typeof window === 'undefined') return
    if (isPaymentNetworkExplorerPath(window.location.pathname)) return
    started = true

    void loadSentry().then((Sentry) => {
        window.removeEventListener('error', bufferEvent)
        window.removeEventListener('unhandledrejection', bufferEvent)

        // Another bootstrap already owns the client; a second init would replace it.
        if (Sentry.getClient()) {
            flushBuffered(Sentry)
            return
        }

        Sentry.init({
            dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
            environment: inferSentryEnvironment(),
            enabled: true,
            tracesSampleRate: 0.1,
            debug: false,

            /*
             * captureConsoleIntegration only calls captureException when one of the
             * console args is an Error instance; otherwise it calls captureMessage,
             * which carries no stack at all. That is how ~3.4% of our exception
             * volume arrived unattributable — a message, no frames, no way to tell
             * which of several call sites produced it. This synthesizes a stack at
             * the capture point for every message event, including the deliberate
             * captureMessage calls in fetchWithSentry and native-auth-capture.
             *
             * Note it lands on `threads`, not `exception.values`, so PostHog's
             * mirror still reports these as an empty exception list; only passing a
             * real Error at the call site clears that.
             */
            attachStacktrace: true,

            // A client-side navigation can enter a private route after init.
            beforeSend: (event) =>
                isPaymentNetworkExplorerPath(window.location.pathname) ? null : beforeSendHandler(event),
            beforeSendTransaction: (event) => (isPaymentNetworkExplorerPath(window.location.pathname) ? null : event),

            integrations: [
                Sentry.captureConsoleIntegration({
                    levels: ['error', 'warn'],
                }),
                // Cross-link Sentry ↔ PostHog: every Sentry error becomes a `$exception`
                // event in PostHog with a Sentry deeplink, and the Sentry event gets a
                // PostHog tag pointing back at the user's profile + session replay.
                // posthog.init() runs in instrumentation-client.ts; the integration uses
                // the singleton lazily, so init order doesn't matter.
                withoutNoise(
                    posthog.sentryIntegration({
                        organization: 'peanut-c34d84c05',
                        projectId: 4505827431415808,
                    })
                ),
            ],
        })

        flushBuffered(Sentry)
    })
}

function flushBuffered(Sentry: Awaited<ReturnType<typeof loadSentry>>): void {
    for (const event of buffered) {
        Sentry.captureException(
            'reason' in event ? event.reason : (event.error ?? new Error(event.message || 'Unknown error'))
        )
    }
    buffered.length = 0
}

if (ENABLED && typeof window !== 'undefined') {
    window.addEventListener('error', bufferEvent)
    window.addEventListener('unhandledrejection', bufferEvent)
}
