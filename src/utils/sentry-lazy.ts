import type { Scope, SeverityLevel } from '@sentry/nextjs'

/**
 * Fire-and-forget Sentry reporting that loads the SDK on first use.
 *
 * `@sentry/nextjs` is ~440 KB and the most expensive script on the marketing
 * site, which does not need error reporting badly enough to pay for it during
 * load. These wrappers keep the SDK out of the initial graph; it arrives when
 * an app route mounts (see sentry-init) or when something actually throws.
 *
 * Reporting is asynchronous and deliberately returns void — no caller used the
 * event id, and `withScope`'s return value was never read either.
 */
type SentryModule = typeof import('@sentry/nextjs')

let loaded: SentryModule | undefined
let loading: Promise<SentryModule> | undefined

export function loadSentry(): Promise<SentryModule> {
    if (loaded) return Promise.resolve(loaded)
    loading ??= import('@sentry/nextjs').then((m) => (loaded = m))
    return loading
}

// The SDK's own signatures are overloaded; these mirror the shapes actually
// called in this codebase rather than reproducing every overload.
type CaptureContext = SeverityLevel | Record<string, unknown>

export function captureException(error: unknown, hint?: Record<string, unknown>): void {
    void loadSentry().then((S) => (S.captureException as (e: unknown, h?: unknown) => void)(error, hint))
}

export function captureMessage(message: string, context?: CaptureContext): void {
    void loadSentry().then((S) => (S.captureMessage as (m: string, c?: unknown) => void)(message, context))
}

export function setUser(user: Parameters<SentryModule['setUser']>[0]): void {
    void loadSentry().then((S) => S.setUser(user))
}

export function withScope(callback: (scope: Scope) => unknown): void {
    void loadSentry().then((S) => S.withScope(callback as (scope: Scope) => void))
}
