export const KYC_PAPERWORK_VERIFICATION_HEADER = 'x-kyc-paperwork-verification'

/** Sent on every KYC call; the API answers Smart Paperwork Verification's flow only for the users it puts on it. */
export function paperworkVerificationHeaders(): Record<string, string> {
    return { [KYC_PAPERWORK_VERIFICATION_HEADER]: '1' }
}
