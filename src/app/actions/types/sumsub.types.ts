// 'bridge-uplift': cross-region EU/NA tap by an applicant whose base verification
// completed on a non-Bridge level — BE moves the applicant to bridge-requirements
// and returns a token for the delta steps (email + Bridge questionnaire). Handled
// generically (token → SDK opens), same as 'manteca'.
export type KycActionType = 'manteca' | 'bridge-direct' | 'bridge-uplift' | 'unsupported-region'

export interface InitiateSumsubKycResponse {
    token: string | null // null when user is already APPROVED or bridge-direct
    applicantId: string | null
    status: SumsubKycStatus
    actionType?: KycActionType // present for cross-region responses
}

export type SumsubKycStatus =
    | 'NOT_STARTED'
    | 'PENDING'
    | 'IN_REVIEW'
    | 'APPROVED'
    | 'REJECTED'
    | 'ACTION_REQUIRED'
    | 'REVERIFYING'

/**
 * User-facing region-intent bucket. One of four picker buttons:
 *   - LATAM → backend mints `general` Sumsub level (Sumsub branches to
 *             `manteca-requirements` for AR/BR applicants)
 *   - ROW   → same as LATAM (pool-tier rails post-approval, no provider submission)
 *   - EU    → `bridge-requirements` (Bridge SEPA / Faster Payments)
 *   - NA    → `bridge-requirements` (Bridge ACH / Wire / SPEI)
 *
 * Legacy `STANDARD` is still accepted by the BE during this rollout (it maps to
 * `general`); hardcoded callers that haven't been migrated to the country-aware
 * pattern keep sending it. Remove once every call site sends one of the four.
 */
export type KYCRegionIntent = 'LATAM' | 'ROW' | 'EU' | 'NA' | 'STANDARD'
