import { type UpdateUserFailureKind } from '@/app/actions/types/users.types'
import { getPlatform, isCapacitor } from '@/utils/capacitor'
import { captureMessage } from '@/utils/sentry-lazy'

/**
 * The sign-up email is required and the step has no skip, so a save that
 * fails after the request layer's own retry blocks the user. Report it at
 * error level under one fingerprint per failure kind, so an alert can page on
 * the first event and on a spike. The event carries no email address.
 */
export function reportEmailSaveFailure({
    failureKind = 'other',
    status,
    attempt,
}: {
    failureKind?: UpdateUserFailureKind
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
