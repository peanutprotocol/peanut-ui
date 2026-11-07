export const KYC_CLIENT_HEADER = 'x-kyc-client'
/** The KYC flows this app runs; the API answers each KYC call for this version. */
export const KYC_CLIENT_VERSION = '2'

export function kycClientHeaders(): Record<string, string> {
    return { [KYC_CLIENT_HEADER]: KYC_CLIENT_VERSION }
}
