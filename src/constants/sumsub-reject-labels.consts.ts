interface RejectLabelInfo {
    title: string
    description: string
}

// map of sumsub reject labels to user-friendly descriptions
const REJECT_LABEL_MAP: Record<string, RejectLabelInfo> = {
    DOCUMENT_BAD_QUALITY: {
        title: 'Low quality document',
        description: 'The document image was blurry, dark, or hard to read. Please upload a clearer photo.',
    },
    DOCUMENT_DAMAGED: {
        title: 'Damaged document',
        description: 'The document appears damaged or worn. Please use a document in good condition.',
    },
    DOCUMENT_INCOMPLETE: {
        title: 'Incomplete document',
        description: 'Part of the document was cut off or missing. Make sure the full document is visible.',
    },
    DOCUMENT_MISSING: {
        title: 'Missing document',
        description: 'A required document was not provided. Please upload all requested documents.',
    },
    DOCUMENT_EXPIRED: {
        title: 'Expired document',
        description: 'The document has expired. Please use a valid, non-expired document.',
    },
    SELFIE_MISMATCH: {
        title: 'Selfie does not match',
        description: 'The selfie did not match the photo on your document. Please try again with a clear selfie.',
    },
    SELFIE_BAD_QUALITY: {
        title: 'Low quality selfie',
        description: 'The selfie was blurry or poorly lit. Please take a clear, well-lit selfie.',
    },
    SELFIE_SPOOFING: {
        title: 'Selfie issue detected',
        description: 'A live selfie is required. Do not use a photo of a photo or a screen.',
    },
    DOCUMENT_FAKE: {
        title: 'Document could not be verified',
        description: 'We were unable to verify the authenticity of your document.',
    },
    GRAPHIC_EDITOR_USAGE: {
        title: 'Edited document detected',
        description: 'The document appears to have been digitally altered.',
    },
    AGE_BELOW_ACCEPTED_LIMIT: {
        title: 'Age requirement not met',
        description: 'You must be at least 18 years old to use this service.',
    },
    UNSUPPORTED_DOCUMENT: {
        title: 'Unsupported document type',
        description: "This type of document is not accepted. Please use a passport, national ID, or driver's license.",
    },
    WRONG_DOCUMENT: {
        title: 'Wrong document provided',
        description: 'The uploaded document does not match what was requested. Please upload the correct document.',
    },
    REGULATIONS_VIOLATIONS: {
        title: 'Regulatory restriction',
        description: 'Verification could not be completed due to regulatory requirements.',
    },
}

const FALLBACK_LABEL_INFO: RejectLabelInfo = {
    title: 'Verification issue',
    description: 'There was an issue with your verification. Please try again or contact support.',
}

// labels that indicate a permanent rejection — used as a frontend heuristic
// until backend provides rejectType
export const TERMINAL_REJECT_LABELS = new Set(['DOCUMENT_FAKE', 'GRAPHIC_EDITOR_USAGE', 'AGE_BELOW_ACCEPTED_LIMIT'])

/** get human-readable info for a sumsub reject label, with a safe fallback */
export const getRejectLabelInfo = (label: string): RejectLabelInfo => {
    return REJECT_LABEL_MAP[label] ?? FALLBACK_LABEL_INFO
}

/** check if any of the reject labels indicate a terminal (permanent) rejection */
export const hasTerminalRejectLabel = (labels: string[]): boolean => {
    return labels.some((label) => TERMINAL_REJECT_LABELS.has(label))
}
