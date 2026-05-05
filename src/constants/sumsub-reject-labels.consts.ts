interface RejectLabelInfo {
    title: string
    description: string
}

// map of sumsub reject labels to user-friendly descriptions.
// source: https://docs.sumsub.com/reference/rejected
// source: https://docs.sumsub.com/reference/resubmission-requested
const REJECT_LABEL_MAP: Record<string, RejectLabelInfo> = {
    // --- data & address issues ---
    PROBLEMATIC_APPLICANT_DATA: {
        title: 'Data mismatch',
        description:
            'Your provided information does not match our records. Please check your name, date of birth, and other details.',
    },
    WRONG_ADDRESS: {
        title: 'Address mismatch',
        description: 'The address you provided does not match your documents. Please correct it and try again.',
    },
    DB_DATA_MISMATCH: {
        title: 'Data inconsistency',
        description: 'Your information does not match the government database. Please verify your details are correct.',
    },
    DB_DATA_NOT_FOUND: {
        title: 'Data not found',
        description: 'Your data could not be found in the government database. Please double-check your details.',
    },
    REQUESTED_DATA_MISMATCH: {
        title: 'Document details mismatch',
        description: 'The document details do not match the information you provided.',
    },
    GPS_AS_POA_SKIPPED: {
        title: 'Address details incomplete',
        description: 'Insufficient address details were provided. Please provide your full address.',
    },

    // --- document quality & completeness ---
    DOCUMENT_BAD_QUALITY: {
        title: 'Low quality document',
        description: 'The document image was blurry, dark, or hard to read. Please upload a clearer photo.',
    },
    LOW_QUALITY: {
        title: 'Low quality document',
        description: 'The document quality is too low to process. Please upload a clearer image.',
    },
    UNSATISFACTORY_PHOTOS: {
        title: 'Unreadable photo',
        description: 'The photo is not readable. Please upload a clearer image.',
    },
    DOCUMENT_DAMAGED: {
        title: 'Damaged document',
        description: 'The document appears damaged or worn. Please use a document in good condition.',
    },
    DOCUMENT_INCOMPLETE: {
        title: 'Incomplete document',
        description: 'Part of the document was cut off or missing. Make sure the full document is visible.',
    },
    INCOMPLETE_DOCUMENT: {
        title: 'Incomplete document',
        description: 'Some pages or sides of the document are missing. Please upload the complete document.',
    },
    DOCUMENT_PAGE_MISSING: {
        title: 'Missing page',
        description: 'A required page of the document is missing. Please upload all pages.',
    },
    DOCUMENT_MISSING: {
        title: 'Missing document',
        description: 'A required document was not provided. Please upload all requested documents.',
    },
    BLACK_AND_WHITE: {
        title: 'Color document required',
        description: 'The document was provided in black and white. Please upload a color image.',
    },
    SCREENSHOTS: {
        title: 'Screenshots not accepted',
        description: 'Screenshots are not accepted. Please upload a direct photo of the document.',
    },
    DIGITAL_DOCUMENT: {
        title: 'Original document required',
        description: 'A digital version was uploaded. Please upload a photo of the original document.',
    },

    // --- document validity ---
    DOCUMENT_EXPIRED: {
        title: 'Expired document',
        description: 'The document has expired. Please use a valid, non-expired document.',
    },
    EXPIRATION_DATE: {
        title: 'Expiration date issue',
        description: 'The document is expired or expiring soon. Please use a document with a valid expiration date.',
    },
    ID_INVALID: {
        title: 'Invalid ID',
        description: 'The identity document is not valid. Please use a different document.',
    },
    UNSUPPORTED_DOCUMENT: {
        title: 'Unsupported document type',
        description: "This type of document is not accepted. Please use a passport, national ID, or driver's license.",
    },
    WRONG_DOCUMENT: {
        title: 'Wrong document provided',
        description: 'The uploaded document does not match what was requested. Please upload the correct document.',
    },
    NOT_DOCUMENT: {
        title: 'Not a valid document',
        description: 'The uploaded file is not a document. Please upload the correct file.',
    },
    DOCUMENT_TEMPLATE: {
        title: 'Template document',
        description: 'The provided document appears to be a template. Please upload your actual document.',
    },
    OUTDATED_DOCUMENT_VERSION: {
        title: 'Outdated document',
        description: 'This is not the most recent version of the document. Please provide the latest version.',
    },
    UNFILLED_ID: {
        title: 'Unreadable document',
        description: 'The document could not be read. Please upload a clearer image.',
    },
    UNSUITABLE_DOCUMENT: {
        title: 'Unsuitable document',
        description: 'The document does not meet the requirements. Please check the requirements and try again.',
    },
    INCOMPATIBLE_LANGUAGE: {
        title: 'Unsupported language',
        description: 'The document is in an unsupported language. Please provide a translated or alternative document.',
    },
    UNSUPPORTED_LANGUAGE: {
        title: 'Unsupported language',
        description: 'The document is in an unsupported language.',
    },
    BAD_PROOF_OF_IDENTITY: {
        title: 'Identity document issue',
        description: 'There was an issue with your identity document. Please upload a valid, clear copy.',
    },
    BAD_PROOF_OF_ADDRESS: {
        title: 'Proof of address issue',
        description:
            'There was an issue with your proof of address. Please upload a valid document with your full name and address.',
    },
    BAD_PROOF_OF_PAYMENT: {
        title: 'Payment proof issue',
        description: 'There was an issue verifying your payment information.',
    },
    ADDITIONAL_DOCUMENT_REQUIRED: {
        title: 'Additional document needed',
        description: 'An additional document is required. Please check the request and upload the needed document.',
    },

    // --- selfie & face matching ---
    SELFIE_MISMATCH: {
        title: 'Selfie does not match',
        description: 'The selfie did not match the photo on your document. Please try again with a clear selfie.',
    },
    BAD_FACE_MATCHING: {
        title: 'Face not clearly visible',
        description: 'Your face was not clearly visible. Please take a well-lit selfie showing your full face.',
    },
    BAD_SELFIE: {
        title: 'Selfie issue',
        description: 'There was an issue with your selfie. Please take a clear, well-lit selfie.',
    },
    BAD_VIDEO_SELFIE: {
        title: 'Video selfie issue',
        description: 'The video selfie check could not be completed. Please try again.',
    },
    SELFIE_BAD_QUALITY: {
        title: 'Low quality selfie',
        description: 'The selfie was blurry or poorly lit. Please take a clear, well-lit selfie.',
    },
    SELFIE_SPOOFING: {
        title: 'Selfie issue detected',
        description: 'A live selfie is required. Do not use a photo of a photo or a screen.',
    },
    FRAUDULENT_LIVENESS: {
        title: 'Liveness check failed',
        description: 'The liveness check could not be completed. Please try again with a live selfie.',
    },

    // --- fraud & forgery (terminal) ---
    DOCUMENT_FAKE: {
        title: 'Document could not be verified',
        description: 'We were unable to verify the authenticity of your document.',
    },
    FORGERY: {
        title: 'Document could not be verified',
        description: 'The document could not be verified. Please use an original, unaltered document.',
    },
    GRAPHIC_EDITOR: {
        title: 'Edited document detected',
        description: 'The document appears to have been digitally altered.',
    },
    GRAPHIC_EDITOR_USAGE: {
        title: 'Edited document detected',
        description: 'The document appears to have been digitally altered.',
    },
    FRAUDULENT_PATTERNS: {
        title: 'Verification failed',
        description: 'Your verification could not be completed due to a security concern.',
    },
    THIRD_PARTY_INVOLVED: {
        title: 'Third party detected',
        description: 'A third party was detected during verification. You must complete verification yourself.',
    },
    BLOCKLIST: {
        title: 'Account restricted',
        description: 'Your account has been restricted. Please contact support.',
    },
    SPAM: {
        title: 'Too many attempts',
        description: 'Too many files were uploaded. Please contact support.',
    },

    // --- regulatory & compliance (terminal) ---
    AGE_REQUIREMENT_MISMATCH: {
        title: 'Age requirement not met',
        description: 'You must meet the minimum age requirement to use this service.',
    },
    AGE_BELOW_ACCEPTED_LIMIT: {
        title: 'Age requirement not met',
        description: 'You must be at least 18 years old to use this service.',
    },
    REGULATIONS_VIOLATIONS: {
        title: 'Regulatory restriction',
        description: 'Verification could not be completed due to regulatory requirements.',
    },
    WRONG_USER_REGION: {
        title: 'Unsupported region',
        description: 'Your country or region is not currently supported.',
    },
    DUPLICATE: {
        title: 'Duplicate account',
        description: 'An account with your details already exists.',
    },
    RESTRICTED_PERSON: {
        title: 'Verification restricted',
        description: 'Your verification could not be completed. Please contact support.',
    },

    // --- compromised persons (terminal) ---
    ADVERSE_MEDIA: {
        title: 'Verification failed',
        description: 'Your verification could not be completed. Please contact support.',
    },
    CRIMINAL: {
        title: 'Verification failed',
        description: 'Your verification could not be completed. Please contact support.',
    },
    COMPROMISED_PERSONS: {
        title: 'Verification failed',
        description: 'Your verification could not be completed. Please contact support.',
    },
    PEP: {
        title: 'Verification failed',
        description: 'Your verification could not be completed due to compliance requirements.',
    },
    SANCTIONS: {
        title: 'Verification failed',
        description: 'Your verification could not be completed due to compliance requirements.',
    },

    // --- profile & consistency ---
    INCONSISTENT_PROFILE: {
        title: 'Inconsistent documents',
        description: 'The documents provided appear to belong to different individuals.',
    },

    // --- availability ---
    CHECK_UNAVAILABLE: {
        title: 'Verification temporarily unavailable',
        description: 'The verification database is currently unavailable. Please try again later.',
    },

    // --- provider submission errors (retryable) ---
    DUPLICATE_EMAIL: {
        title: 'Email already in use',
        description:
            'The email you entered is already associated with another account. Please verify again with a different email.',
    },
}

const FALLBACK_LABEL_INFO: RejectLabelInfo = {
    title: 'Verification issue',
    description: 'There was an issue with your verification. Please try again or contact support.',
}

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

/** get human-readable info for a sumsub reject label, with a safe fallback */
export const getRejectLabelInfo = (label: string): RejectLabelInfo => {
    return REJECT_LABEL_MAP[label] ?? FALLBACK_LABEL_INFO
}

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
