export const KYC_VERIFY_ONCE_HEADER = 'x-kyc-verify-once'

/** Sent on every KYC call; the API answers `flow: 'verify-once'` only for the users it puts on that flow. */
export function verifyOnceHeaders(): Record<string, string> {
    return { [KYC_VERIFY_ONCE_HEADER]: '1' }
}
