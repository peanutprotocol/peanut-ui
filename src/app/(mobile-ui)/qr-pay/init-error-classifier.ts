import { API_ERROR_CODES, wireErrorCode } from '@/services/api-error'

export type QrInitCopy = { cap: string; merchant: string; kyc: string; pixMinAmount: string }

export type DeterministicInitError = {
    message: string
    /**
     * Whether a different amount can clear this rejection. The cap fires when
     * THIS payment exceeds the remaining headroom, and the Pix minimum when it
     * falls under the floor — both invite another try. A merchant limit or an
     * unfinished KYC does not care what the user types.
     *
     * The screen reads this to decide whether the error dead-ends the flow: an
     * amount-retryable one must not leave Pay disabled, or the copy's own
     * advice ("try a smaller amount") cannot be followed.
     */
    amountRetryable: boolean
}

/**
 * Deterministic `/manteca/qr-payment/init` rejections → copy that names the
 * real cause. Shared by the scan-time query and the post-amount re-init
 * because they hit the same backend checks: an open-amount QR only learns its
 * cap verdict once the user types a number, and that second path used to
 * collapse every one of these into "unexpected error" — the framing
 * product/providers/fiat/README.md records as having blocked a capped user for
 * three days.
 *
 * Returns null when the failure is not one of these; the generic and retry
 * handling differ between the two paths, so each caller keeps its own.
 *
 * Its own module rather than page.tsx: an app-router page should export only
 * what Next.js allows, and importing this from a test should not drag the
 * page's whole graph (wallet hooks, the zerodev SDK, posthog) along with it.
 */
export function deterministicInitErrorMessage(error: unknown, copy: QrInitCopy): DeterministicInitError | null {
    const message = error instanceof Error ? error.message : ''
    // Wire code first: the KYC rejection's prose is a plain sentence the
    // backend can reword, its `code` is stable.
    if (wireErrorCode(error) === API_ERROR_CODES.MANTECA_KYC_REQUIRED) {
        return { message: copy.kyc, amountRetryable: false }
    }
    if (message.includes('MANTECA_SOURCE_OVER_MONTHLY_CAP')) {
        return { message: copy.cap, amountRetryable: true }
    }
    /*
     * The two merchant blocks share copy but not retryability. The volume cap
     * compares `rolling30dTotal + attempted >= LIMIT` (peanut-api-ts
     * cap-check.ts), so a smaller amount can still fit under the merchant's
     * remaining headroom. The refund block keys off the age and count of the
     * merchant's recent refunds and ignores the amount entirely — no number
     * the user types clears it.
     */
    if (message.includes('MANTECA_MERCHANT_VOLUME_NEAR_CAP')) {
        return { message: copy.merchant, amountRetryable: true }
    }
    if (message.includes('MANTECA_MERCHANT_RECENT_REFUND')) {
        return { message: copy.merchant, amountRetryable: false }
    }
    if (message.includes('MANTECA_USER_NOT_PROVISIONED') || message.includes('User KYC not approved')) {
        return { message: copy.kyc, amountRetryable: false }
    }
    if (message.includes('PIX_MIN_AMOUNT')) {
        return { message: copy.pixMinAmount, amountRetryable: true }
    }
    return null
}
