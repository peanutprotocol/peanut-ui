import type { Scope, SeverityLevel } from '@sentry/nextjs'

/**
 * Fire-and-forget Sentry reporting that loads the SDK on first use.
 *
 * `@sentry/nextjs` is ~440 KB and, imported statically, lands in the initial
 * bundle of every page that reaches any module touching it — including the
 * marketing site, which reports errors but should not pay for the SDK during
 * load. These wrappers keep the SDK out of the initial graph; the first report
 * (or `Sentry.init` at idle) pulls it in.
 *
 * Reporting is asynchronous and deliberately returns void — no caller used the
 * event id, and `withScope`'s return value was never read either. Anything
 * thrown before the SDK resolves is held by the buffer in
 * sentry.client.config.ts and replayed on init.
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
// called in this codebase rather than trying to reproduce every overload.
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
