import { type UpdateUserFailureKind } from '@/app/actions/types/users.types'
import { getPlatform, isCapacitor } from '@/utils/capacitor'
import { captureMessage } from '@/utils/sentry-lazy'

/**
 * A failed first-email save blocks signup. Protected replacement failures
 * keep the existing email and allow continuation. Report failures at
 * error level under one fingerprint per failure kind, so an alert can page on
 * the first event and on a spike. The event carries no email address.
 */
export function reportEmailSaveFailure({
    failureKind = 'other',
    status,
    attempt,
}: {
    failureKind?:
        | UpdateUserFailureKind
        | 'step_up_required'
        | 'email_verification_required'
        | 'email_replacement_disabled'
    status?: number
    /** How many times the user has pressed Continue on this step. */
    attempt: number
}): void {
    captureMessage('Sign-up email save failed', {
        level: 'error',
        fingerprint: ['signup-email-save-failed', failureKind],
        tags: {
            flow: 'signup',
            step: 'notification-email',
            failure_kind: failureKind,
            ...(status !== undefined && { http_status: String(status) }),
            platform: getPlatform(),
            native: String(isCapacitor()),
            attempt: String(attempt),
        },
    })
}
