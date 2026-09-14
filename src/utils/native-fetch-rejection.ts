import type { CaptureResult } from 'posthog-js'

/*
 * Lives in its own leaf module (no runtime imports) because
 * instrumentation-client's posthog `before_send` needs the predicate, and that
 * file must not pull `@sentry/nextjs` in statically — see the dynamic-import
 * note there. network-triage.ts re-imports it from here.
 */

// Engine-exact rejection copy; also matched by the connectionLost classifier
// in friendly-error.utils.tsx, which imports this predicate to stay in sync.
export const NATIVE_FETCH_REJECTION_MESSAGES: readonly string[] = [
    'Failed to fetch', // Chromium, so every Android WebView
    'Load failed', // WebKit
    'NetworkError when attempting to fetch resource.', // Gecko
]

export function isNativeFetchRejection(name: string | undefined, message: string | undefined): boolean {
    return name === 'TypeError' && message !== undefined && NATIVE_FETCH_REJECTION_MESSAGES.includes(message)
}

/*
 * PostHog exception autocapture double-reports this class: the fetch rejection
 * is already handled in the flow (retried, triaged, reported through Sentry —
 * where server-side filtering keeps it out of the issue list), so the raw
 * `TypeError: Load failed` burst during an iOS connectivity blip is pure noise
 * there (TASK-22408). Shape per posthog-js error tracking: exceptions ride in
 * `properties.$exception_list` as `{ type, value }` entries.
 */
export function isNativeFetchRejectionExceptionEvent(event: CaptureResult | null): boolean {
    if (event?.event !== '$exception') return false
    const list = event.properties?.$exception_list as Array<{ type?: string; value?: string }> | undefined
    if (!Array.isArray(list) || list.length === 0) return false
    // Drop only when the match is certain: every exception in the chain is a
    // native fetch rejection. A mixed chain passes through untouched.
    return list.every((exception) => isNativeFetchRejection(exception?.type, exception?.value))
}
