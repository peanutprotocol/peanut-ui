/**
 * Residence-based prequalification tiers for the signup residence step.
 * Advisory only: screens name no country, and the compliance decision stays
 * with KYC (Sumsub-verified address). Follow-up tracked in the onboarding
 * proposal: these lists should be served by the API from the same compliance
 * source that configures the providers, so changes don't need a release.
 */

/**
 * Full restriction: neither bank transfers nor card issuing are available.
 * Sanctions-comprehensive jurisdictions (CN, IR, RU, BY, KP, SY, CU, MM), the
 * Sumsub document-rejection set (RU, CN, HK are configured as unacceptable in
 * the Sumsub dashboard, so no KYC can ever pass), plus Peanut's own UK block
 * (TASK-20729).
 */
export const RESTRICTED_RESIDENCE_ISO2 = new Set(['CN', 'IR', 'RU', 'BY', 'GB', 'KP', 'SY', 'CU', 'HK', 'MM'])

/**
 * Card-only restriction: Rain's published prohibited-issuance list minus the
 * fully-restricted set above (mirrored in peanut-api-ts card/geo-eligibility).
 * Banking rails still work. UA is listed country-wide per Rain's issuance
 * list; Crimea/Donetsk/Luhansk are additionally sanctions-blocked outright,
 * but a country picker cannot distinguish regions.
 */
export const CARD_RESTRICTED_RESIDENCE_ISO2 = new Set(['IN', 'TR', 'UA', 'VE', 'VN', 'IL', 'IQ', 'NP', 'NI'])

/**
 * Banking-only restriction: Bridge onboards these residents but no rail is
 * ever `Yes`, so the account is unusable. The card and everything else still
 * work.
 *
 * GW is in Bridge's table and absent from Bridge's prose note on the same
 * page; this list mirrored the prose and lost it. The table is the authority
 * (product/providers/fiat/eligibility.md).
 */
export const BANKING_RESTRICTED_RESIDENCE_ISO2 = new Set(['DZ', 'BI', 'GW', 'JP', 'TN'])

/**
 * countryData is the add-money DESTINATION list and deliberately omits
 * sanctioned countries. The residence question must list every country, or a
 * restricted resident cannot answer truthfully and never sees the honest
 * heads-up. These fill the gap in the selector only.
 */
export const SUPPLEMENTAL_RESIDENCE_OPTIONS: ReadonlyArray<{ iso2: string; title: string }> = [
    { iso2: 'CU', title: 'Cuba' },
    { iso2: 'IR', title: 'Iran' },
    { iso2: 'KP', title: 'North Korea' },
    { iso2: 'MM', title: 'Myanmar' },
    { iso2: 'RU', title: 'Russia' },
    { iso2: 'SY', title: 'Syria' },
]
