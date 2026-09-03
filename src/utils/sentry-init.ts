import { beforeSendHandler } from '../../sentry.utils'
import { posthogErrorMirror, withoutNoise } from '@/utils/sentry-posthog-mirror'
import { inferSentryEnvironment } from '@/utils/sentry-env'
import { loadSentry } from '@/utils/sentry-lazy'
import { isPaymentNetworkExplorerPath } from '@/utils/private-routes'

export { withoutNoise }

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
                posthogErrorMirror(),
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
