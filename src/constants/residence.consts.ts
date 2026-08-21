/**
 * ISO-2 residence countries where regulations prevent bank transfers and card
 * issuing. The residence step shows a generic heads-up (no country is named on
 * screen) before the account exists. Advisory only — the compliance decision
 * stays with KYC (Sumsub-verified address).
 */
export const RESTRICTED_RESIDENCE_ISO2 = new Set(['CN', 'IR', 'RU', 'BY', 'GB'])
