/**
 * Registry of Sumsub reject codes. This module stays copy-free — the
 * user-facing title/description for each code lives in the `kyc.rejectLabels`
 * catalog namespace and is resolved at the render site (see RejectLabelsList).
 *
 * source: https://docs.sumsub.com/reference/rejected
 * source: https://docs.sumsub.com/reference/resubmission-requested
 */

export const REJECT_LABEL_CODES = [
    'PROBLEMATIC_APPLICANT_DATA',
    'WRONG_ADDRESS',
    'DB_DATA_MISMATCH',
    'DB_DATA_NOT_FOUND',
    'REQUESTED_DATA_MISMATCH',
    'GPS_AS_POA_SKIPPED',
    'DOCUMENT_BAD_QUALITY',
    'LOW_QUALITY',
    'UNSATISFACTORY_PHOTOS',
    'DOCUMENT_DAMAGED',
    'DOCUMENT_INCOMPLETE',
    'INCOMPLETE_DOCUMENT',
    'DOCUMENT_PAGE_MISSING',
    'DOCUMENT_MISSING',
    'BLACK_AND_WHITE',
    'SCREENSHOTS',
    'DIGITAL_DOCUMENT',
    'DOCUMENT_EXPIRED',
    'EXPIRATION_DATE',
    'ID_INVALID',
    'UNSUPPORTED_DOCUMENT',
    'WRONG_DOCUMENT',
    'NOT_DOCUMENT',
    'DOCUMENT_TEMPLATE',
    'OUTDATED_DOCUMENT_VERSION',
    'UNFILLED_ID',
    'UNSUITABLE_DOCUMENT',
    'INCOMPATIBLE_LANGUAGE',
    'UNSUPPORTED_LANGUAGE',
    'BAD_PROOF_OF_IDENTITY',
    'BAD_PROOF_OF_ADDRESS',
    'BAD_PROOF_OF_PAYMENT',
    'ADDITIONAL_DOCUMENT_REQUIRED',
    'SELFIE_MISMATCH',
    'BAD_FACE_MATCHING',
    'BAD_SELFIE',
    'BAD_VIDEO_SELFIE',
    'SELFIE_BAD_QUALITY',
    'SELFIE_SPOOFING',
    'FRAUDULENT_LIVENESS',
    'DOCUMENT_FAKE',
    'FORGERY',
    'GRAPHIC_EDITOR',
    'GRAPHIC_EDITOR_USAGE',
    'FRAUDULENT_PATTERNS',
    'THIRD_PARTY_INVOLVED',
    'BLOCKLIST',
    'SPAM',
    'AGE_REQUIREMENT_MISMATCH',
    'AGE_BELOW_ACCEPTED_LIMIT',
    'REGULATIONS_VIOLATIONS',
    'WRONG_USER_REGION',
    'DUPLICATE',
    'RESTRICTED_PERSON',
    'ADVERSE_MEDIA',
    'CRIMINAL',
    'COMPROMISED_PERSONS',
    'PEP',
    'SANCTIONS',
    'INCONSISTENT_PROFILE',
    'CHECK_UNAVAILABLE',
    'DUPLICATE_EMAIL',
] as const

export type RejectLabelCode = (typeof REJECT_LABEL_CODES)[number]

/** Code used when Sumsub returns a label we have no copy for. */
export const FALLBACK_REJECT_LABEL_CODE = 'FALLBACK'

export type RejectLabelDisplayCode = RejectLabelCode | typeof FALLBACK_REJECT_LABEL_CODE

const KNOWN_CODES: ReadonlySet<string> = new Set(REJECT_LABEL_CODES)

/** Map a raw Sumsub label to a code we have copy for, falling back safely. */
export const rejectLabelCode = (label: string): RejectLabelDisplayCode =>
    KNOWN_CODES.has(label) ? (label as RejectLabelCode) : FALLBACK_REJECT_LABEL_CODE

// labels that indicate a permanent rejection — used as a frontend heuristic
// until backend provides rejectType
export const TERMINAL_REJECT_LABELS = new Set([
    'DOCUMENT_FAKE',
    'FORGERY',
    'GRAPHIC_EDITOR_USAGE',
    'GRAPHIC_EDITOR',
    'AGE_BELOW_ACCEPTED_LIMIT',
    'AGE_REQUIREMENT_MISMATCH',
    'FRAUDULENT_PATTERNS',
    'FRAUDULENT_LIVENESS',
    'BLOCKLIST',
    'ADVERSE_MEDIA',
    'CRIMINAL',
    'COMPROMISED_PERSONS',
    'PEP',
    'SANCTIONS',
    'DUPLICATE',
])

/** check if any of the reject labels indicate a terminal (permanent) rejection */
export const hasTerminalRejectLabel = (labels: string[]): boolean => {
    return labels.some((label) => TERMINAL_REJECT_LABELS.has(label))
}

const MAX_RETRY_COUNT = 2

/** determine if a rejection is terminal (permanent, cannot be retried) */
export const isTerminalRejection = ({
    rejectType,
    failureCount,
    rejectLabels,
}: {
    rejectType?: 'RETRY' | 'FINAL' | 'PROVIDER_FIXABLE' | 'PROVIDER_FINAL' | null
    failureCount?: number
    rejectLabels?: string[] | null
}): boolean => {
    if (rejectType === 'FINAL' || rejectType === 'PROVIDER_FINAL') return true
    if (failureCount && failureCount >= MAX_RETRY_COUNT) return true
    if (rejectLabels?.length && hasTerminalRejectLabel(rejectLabels)) return true
    return false
}
