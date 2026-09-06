/**
 * Registry of `CapabilityReason.code` values the backend resolver emits
 * (peanut-api-ts `src/kyc/capabilities/resolver.ts` + `rail-state.ts` +
 * `level-registry.ts` RequirementCode). This module stays copy-free — the
 * user-facing line per code lives in the `identity.reasons` catalog namespace
 * and is resolved at the render site (same pattern as sumsub-reject-labels).
 *
 * Unlike rejectLabelCode there is NO fallback key: an unknown code returns
 * `undefined` and the call site renders the backend's `userMessage` prose —
 * the BE ships vetted, display-ready copy for every reason, so unknown codes
 * degrade to (English) prose rather than a generic line that could be wrong.
 */

export const REASON_CODE_KEYS = {
    // RequirementCode family (fixable RFIs)
    tax_identification_number: 'reasons.tax_identification_number',
    address_of_residence: 'reasons.address_of_residence',
    proof_of_address: 'reasons.proof_of_address',
    source_of_funds: 'reasons.source_of_funds',
    proof_of_source_of_funds: 'reasons.proof_of_source_of_funds',
    birth_details: 'reasons.birth_details',
    eea_uplift: 'reasons.eea_uplift',
    eea_uplift_with_tin: 'reasons.eea_uplift_with_tin',
    eea_tin_reupload: 'reasons.eea_tin_reupload',
    pep_documentation: 'reasons.pep_documentation',
    fep_documentation: 'reasons.fep_documentation',
    // pipeline / provider states
    email_required: 'reasons.email_required',
    submission_failed: 'reasons.submission_failed',
    proof_of_address_review: 'reasons.proof_of_address_review',
    bridge_tos_required: 'reasons.bridge_tos_required',
    bridge_tos_v2_required: 'reasons.bridge_tos_v2_required',
    bridge_processing: 'reasons.bridge_processing',
    // rejections
    // document_rejected is deliberately NOT mapped: the backend only emits it
    // with the self-heal classifier's fixable-specific prose ("Your ID photo
    // was blurry. Please upload a clearer photo.") — a generic catalog line
    // would mask the instruction. It renders the BE prose until the
    // classifier's stable `action` code (REUPLOAD_ID, …) reaches the wire
    // (api-ts follow-up, #1249 pattern).
    verification_blocked: 'reasons.verification_blocked',
    terminal_rejection: 'reasons.terminal_rejection',
    bridge_terminal_rejection: 'reasons.bridge_terminal_rejection',
    duplicate_customer_detected: 'reasons.duplicate_customer_detected',
    // Rain card rejections
    region_block: 'reasons.region_block',
    compliance_block: 'reasons.compliance_block',
    card_rejected: 'reasons.card_rejected',
    // identity (Sumsub) terminal causes — sibling of the rail codes above, but
    // sourced from `user.identityVerification.reason` rather than a rail.
    identity_region_restricted: 'reasons.identity_region_restricted',
    // restrictions
    manteca_us_nationality: 'reasons.manteca_us_nationality',
    country_not_supported: 'reasons.country_not_supported',
    // A Manteca first-party rail whose submission found no CUIT/CPF. Reachable
    // today only in Argentina, i.e. an es-419 audience — without this entry the
    // one population that can see it gets the backend's English userMessage.
    tax_id_unresolved: 'reasons.tax_id_unresolved',
    // The residence gate parked a Bridge rail because we hold no usable address
    // for the user. Self-serve: the paired action opens the address RFI. Without
    // this entry the copy ships in English to every locale.
    residence_unresolved: 'reasons.residence_unresolved',
    uk_resident_blocked: 'reasons.uk_resident_blocked',
} as const

export type KnownReasonCode = keyof typeof REASON_CODE_KEYS

export type ReasonCodeKey = (typeof REASON_CODE_KEYS)[KnownReasonCode]

/** Catalog key for a known reason code; undefined → render the BE prose. */
export const reasonCodeKey = (code: string | null | undefined): ReasonCodeKey | undefined =>
    code && code in REASON_CODE_KEYS ? REASON_CODE_KEYS[code as KnownReasonCode] : undefined
