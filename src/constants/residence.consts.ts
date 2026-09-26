/**
 * Residence-based prequalification tiers for the signup residence step.
 * Advisory only: screens name no country, and the compliance decision stays
 * with KYC (Sumsub-verified address). Follow-up tracked in the onboarding
 * proposal: these lists should be served by the API from the same compliance
 * source that configures the providers, so changes don't need a release.
 */

/**
 * Full restriction: neither bank transfers nor card issuing. Mirrors
 * peanut-api-ts `src/kyc/residence-restrictions.ts` exactly; each country is
 * here because both halves are closed to it, each for its own reason:
 *
 *   - IR, RU, BY, KP, SY, CU, MM: sanctioned (product/countries.md), on
 *     Bridge's Prohibited list and on Rain's prohibited-issuance list.
 *   - VE, IQ: on Bridge's Prohibited list and on Rain's list (TASK-23054 R2).
 *   - CN: Bridge onboards it but serves no rail, and it is on Rain's list.
 *   - GB: Peanut's own UK rule for both (TASK-20729).
 *
 * The Sumsub dashboard also rejects CN- and RU-issued documents. That is a
 * document rule, not a residence one, and decides nothing here.
 */
export const RESTRICTED_RESIDENCE_ISO2 = new Set(['CN', 'IR', 'RU', 'BY', 'GB', 'KP', 'SY', 'CU', 'MM', 'VE', 'IQ'])

/**
 * Card only: Rain's published prohibited-issuance list minus the full set
 * above (mirrored in peanut-api-ts card/geo-eligibility). Banking rails still
 * work. UA is country-wide per Rain's issuance list; the Crimea, Donetsk and
 * Luhansk regions are additionally sanctions-blocked outright, but residence
 * is declared per country.
 */
export const CARD_RESTRICTED_RESIDENCE_ISO2 = new Set(['IN', 'TR', 'UA', 'VN', 'IL', 'NP', 'NI'])

/**
 * Banking only. The card still works. Two sources:
 *
 *   - Bridge onboards these residences but no rail is ever `Yes`, so the
 *     account is unusable: DZ, BI, GW, JP, TN. GW is in Bridge's table and
 *     absent from Bridge's prose note on the same page; the table is the
 *     authority (mono product/providers/fiat/eligibility.md).
 *   - Bridge's Prohibited list: AF, SD, LY, PS (Gaza and West Bank), LB, YE,
 *     SO, SS, CD. A Bridge check for these residents can only end in
 *     rejection, so the app must not send them into one (TASK-23054 R2).
 *     The other Prohibited residences are in the full set above.
 *
 * HK is in no tier. It was in the full set only because the Sumsub dashboard
 * rejects HK-issued documents — a document rule, and the document's issuing
 * country never decides eligibility (product/card.md). HK is on neither
 * Bridge's Prohibited list nor any card issuer's list, so Bridge's own
 * onboarding and Rain's application stay the checks (TASK-23054 R1).
 */
export const BANKING_RESTRICTED_RESIDENCE_ISO2 = new Set([
    'DZ',
    'BI',
    'GW',
    'JP',
    'TN',
    'AF',
    'SD',
    'LY',
    'PS',
    'LB',
    'YE',
    'SO',
    'SS',
    'CD',
])

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
