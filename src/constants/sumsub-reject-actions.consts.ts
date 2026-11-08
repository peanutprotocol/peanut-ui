import type { RejectLabelDisplayCode } from './sumsub-reject-labels.consts'

/**
 * What a user can do about each Sumsub reject label. Copy-free like the label
 * registry: the lines and buttons live in the `kyc.rejectActions` catalog.
 *
 *   retry_document  — a new photo of the ID, or another document
 *   retry_selfie    — a new selfie
 *   check_details   — the typed details disagree with the ID or a database
 *   try_later       — the check itself was unavailable
 *   other_account   — these documents or this email belong to another Peanut account
 *   contact_support — a decision only a person can review; never named to the user
 *   not_available   — age, region or regulation: another try cannot change it
 */
export type RejectAction =
    | 'retry_document'
    | 'retry_selfie'
    | 'check_details'
    | 'try_later'
    | 'other_account'
    | 'contact_support'
    | 'not_available'

export const REJECT_LABEL_ACTIONS = {
    PROBLEMATIC_APPLICANT_DATA: 'check_details',
    WRONG_ADDRESS: 'check_details',
    DB_DATA_MISMATCH: 'check_details',
    DB_DATA_NOT_FOUND: 'check_details',
    REQUESTED_DATA_MISMATCH: 'check_details',
    GPS_AS_POA_SKIPPED: 'check_details',
    DOCUMENT_BAD_QUALITY: 'retry_document',
    LOW_QUALITY: 'retry_document',
    UNSATISFACTORY_PHOTOS: 'retry_document',
    DOCUMENT_DAMAGED: 'retry_document',
    DOCUMENT_INCOMPLETE: 'retry_document',
    INCOMPLETE_DOCUMENT: 'retry_document',
    DOCUMENT_PAGE_MISSING: 'retry_document',
    DOCUMENT_MISSING: 'retry_document',
    BLACK_AND_WHITE: 'retry_document',
    SCREENSHOTS: 'retry_document',
    DIGITAL_DOCUMENT: 'retry_document',
    DOCUMENT_EXPIRED: 'retry_document',
    EXPIRATION_DATE: 'retry_document',
    ID_INVALID: 'retry_document',
    UNSUPPORTED_DOCUMENT: 'retry_document',
    WRONG_DOCUMENT: 'retry_document',
    NOT_DOCUMENT: 'retry_document',
    DOCUMENT_TEMPLATE: 'retry_document',
    OUTDATED_DOCUMENT_VERSION: 'retry_document',
    UNFILLED_ID: 'retry_document',
    UNSUITABLE_DOCUMENT: 'retry_document',
    INCOMPATIBLE_LANGUAGE: 'retry_document',
    UNSUPPORTED_LANGUAGE: 'retry_document',
    BAD_PROOF_OF_IDENTITY: 'retry_document',
    BAD_PROOF_OF_ADDRESS: 'retry_document',
    BAD_PROOF_OF_PAYMENT: 'retry_document',
    ADDITIONAL_DOCUMENT_REQUIRED: 'retry_document',
    SELFIE_MISMATCH: 'retry_selfie',
    BAD_FACE_MATCHING: 'retry_selfie',
    BAD_SELFIE: 'retry_selfie',
    BAD_VIDEO_SELFIE: 'retry_selfie',
    SELFIE_BAD_QUALITY: 'retry_selfie',
    // a photo of a photo or a screen: a live selfie passes, so it is a retry while Sumsub allows one
    SELFIE_SPOOFING: 'retry_selfie',
    FRAUDULENT_LIVENESS: 'contact_support',
    DOCUMENT_FAKE: 'contact_support',
    FORGERY: 'contact_support',
    GRAPHIC_EDITOR: 'contact_support',
    GRAPHIC_EDITOR_USAGE: 'contact_support',
    FRAUDULENT_PATTERNS: 'contact_support',
    THIRD_PARTY_INVOLVED: 'contact_support',
    BLOCKLIST: 'contact_support',
    SPAM: 'contact_support',
    AGE_REQUIREMENT_MISMATCH: 'not_available',
    AGE_BELOW_ACCEPTED_LIMIT: 'not_available',
    REGULATIONS_VIOLATIONS: 'not_available',
    WRONG_USER_REGION: 'not_available',
    DUPLICATE: 'other_account',
    RESTRICTED_PERSON: 'contact_support',
    ADVERSE_MEDIA: 'contact_support',
    CRIMINAL: 'contact_support',
    COMPROMISED_PERSONS: 'contact_support',
    PEP: 'contact_support',
    SANCTIONS: 'contact_support',
    INCONSISTENT_PROFILE: 'contact_support',
    CHECK_UNAVAILABLE: 'try_later',
    DUPLICATE_EMAIL: 'other_account',
    FALLBACK: 'contact_support',
} as const satisfies Record<RejectLabelDisplayCode, RejectAction>

/** Most severe first: with several labels, the first action any of them maps to is the one offered. */
export const REJECT_ACTION_SEVERITY: readonly RejectAction[] = [
    'not_available',
    'contact_support',
    'other_account',
    'check_details',
    'retry_document',
    'retry_selfie',
    'try_later',
]

/** Actions that start a new attempt: only offered while the identity can still pass. */
export const RETRY_ACTIONS: ReadonlySet<RejectAction> = new Set([
    'retry_document',
    'retry_selfie',
    'check_details',
    'try_later',
])
