import { addBreadcrumb, captureException } from '@sentry/nextjs'
import { nativePasskeyFailure } from './native-passkey-errors'

// Recovery, reporting and monitoring policy: https://github.com/peanutprotocol/mono/blob/main/engineering/ui/passkey-failures.md
type PasskeyOperation = 'login' | 'registration' | 'sign-user-op' | 'send-user-op'
const REPORT_INTERVAL_MS = 5 * 60_000
const lastReported = new Map<string, number>()
const reportedErrors = new WeakSet<object>()

/** Called only at a passkey flow's owning catch, after bounded recovery finishes.
 * Every attempt remains in ceremony analytics; repeated diagnostics get one report per
 * operation/reason every five minutes. Unknown application failures stay with the caller. */
/** The reason `reportPasskeyFailure` reports this error under; undefined when it leaves the error to the caller. */
export function passkeyFailureReason(error: unknown): string | undefined {
    const name = error instanceof Error ? error.name : undefined
    return nativePasskeyFailure(error) ?? (name === 'NotAllowedError' ? 'not_completed' : undefined)
}

export function reportPasskeyFailure(error: unknown, operation: PasskeyOperation): boolean {
    const reason = passkeyFailureReason(error)
    if (!reason) return false
    if (error && typeof error === 'object') {
        if (reportedErrors.has(error)) return true
        reportedErrors.add(error)
    }
    addBreadcrumb({ category: 'passkey.failure', level: 'info', data: { operation, reason } })
    // Device requirements are expected outcomes, with specific UI recovery.
    // A bare NotAllowedError is ambiguous, so keep a bounded diagnostic warning.
    if (reason === 'canceled' || reason === 'device_locked' || reason === 'biometry_required') return true
    const key = `${operation}:${reason}`
    const now = Date.now()
    const previous = lastReported.get(key)
    if (previous !== undefined && now - previous < REPORT_INTERVAL_MS) return true
    lastReported.set(key, now)
    captureException(error, {
        level: reason.startsWith('association_') ? 'error' : 'warning',
        fingerprint: ['passkey-failure', operation, reason],
        tags: { error_type: 'passkey_failure', passkey_operation: operation, passkey_reason: reason },
    })
    return true
}
