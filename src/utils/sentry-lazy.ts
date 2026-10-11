import type { Scope, SeverityLevel } from '@sentry/nextjs'
import posthog from 'posthog-js'
import { importWithChunkRetry } from '@/utils/chunk-error-recovery'

/**
 * Fire-and-forget Sentry reporting that loads the SDK on first use.
 *
 * `@sentry/nextjs` is ~440 KB and the most expensive script on the marketing
 * site, which does not need error reporting badly enough to pay for it during
 * load. These wrappers keep the SDK out of the initial graph; it arrives when
 * an app route mounts (see sentry-init) or when something actually throws.
 *
 * Reporting returns void — no caller used the event id, and `withScope`'s
 * return value was never read either. Once the SDK is loaded every call goes
 * through synchronously: the SDK pops a `withScope` fork the moment the
 * callback returns, so a capture deferred to a later microtask lands on the
 * outer scope and loses the fingerprint/tags the callback just set. Only
 * calls made while the SDK is still in flight are queued behind the import.
 */
type SentryModule = typeof import('@sentry/nextjs')

/*
 * A failed SDK chunk must neither disable reporting for the rest of the
 * document nor escape as an unhandled rejection: the inline chunk-recovery
 * script reloads the page on any unhandled ChunkLoadError. Each later call
 * starts a fresh load, up to MAX_LOAD_ATTEMPTS; the final failure goes to
 * PostHog, the one channel left.
 */
const MAX_LOAD_ATTEMPTS = 3

let loaded: SentryModule | undefined
let loading: Promise<SentryModule> | undefined
let failedLoads = 0

export function loadSentry(): Promise<SentryModule> {
    if (loaded) return Promise.resolve(loaded)
    if (!loading) {
        const attempt = importWithChunkRetry(() => import('@sentry/nextjs')).then((m) => (loaded = m))
        loading = attempt
        attempt.catch((error) => {
            failedLoads += 1
            if (failedLoads < MAX_LOAD_ATTEMPTS) loading = undefined
            else posthog.captureException(error, { source: 'sentry_sdk_load' })
        })
    }
    return loading
}

function withSdk(fn: (S: SentryModule) => void): void {
    if (loaded) fn(loaded)
    else void loadSentry().then(fn, () => {})
}

// The SDK's own signatures are overloaded; these mirror the shapes actually
// called in this codebase rather than reproducing every overload.
type CaptureContext = SeverityLevel | Record<string, unknown>

export function captureException(error: unknown, hint?: Record<string, unknown>): void {
    withSdk((S) => (S.captureException as (e: unknown, h?: unknown) => void)(error, hint))
}

export function captureMessage(message: string, context?: CaptureContext): void {
    withSdk((S) => (S.captureMessage as (m: string, c?: unknown) => void)(message, context))
}

export function setUser(user: Parameters<SentryModule['setUser']>[0]): void {
    withSdk((S) => S.setUser(user))
}

export function withScope(callback: (scope: Scope) => unknown): void {
    withSdk((S) => S.withScope(callback as (scope: Scope) => void))
}

/*
 * The timestamp is stamped here rather than left to the SDK: a breadcrumb
 * recorded before the import resolves is delivered on a later microtask, and
 * the SDK would date it to delivery, putting it out of order against the very
 * error it was left to explain.
 */
export function addBreadcrumb(breadcrumb: Parameters<SentryModule['addBreadcrumb']>[0]): void {
    const timestamp = Date.now() / 1000
    withSdk((S) => S.addBreadcrumb({ timestamp, ...breadcrumb }))
}
