export type PaperworkVerificationStepId =
    | 'purpose'
    | 'work'
    | 'money'
    | 'birth'
    | 'address'
    | 'phone'
    | 'declarations'
    | 'tax'
export type PaperworkVerificationFeature = 'bank' | 'card' | 'local'
export type PaperworkVerificationFieldKind =
    | 'choice'
    | 'occupation'
    | 'country'
    | 'place'
    | 'text'
    | 'phone'
    | 'taxId'
    | 'toggle'
export type PaperworkVerificationTaxFormat = 'ssn' | 'cuit' | 'cpf' | 'rut' | 'curp' | 'cc' | null

export interface PaperworkVerificationField {
    key: string
    kind: PaperworkVerificationFieldKind
    required: boolean
    options?: string[]
    format?: PaperworkVerificationTaxFormat
    locked?: boolean
    /** A `place` field suggests places of the country this field of the step holds. */
    countryField?: string
    /** A toggle's value is 'yes' or 'no'. */
    value: string | null
}

export interface PaperworkVerificationStep {
    id: PaperworkVerificationStepId
    features: Array<'base' | PaperworkVerificationFeature>
    fields: PaperworkVerificationField[]
    answered: boolean
}

export interface PaperworkVerificationQuestions {
    available: boolean
    attemptId: string | null
    residence: string | null
    steps: PaperworkVerificationStep[]
    firstUnanswered: PaperworkVerificationStepId | null
    progress: { done: number; total: number }
}

export type PaperworkVerificationAnswers = Record<string, string>

export type SaveAnswersResult =
    | { kind: 'saved'; next: PaperworkVerificationStepId | null }
    | { kind: 'invalid'; errors: Record<string, string> }
    | { kind: 'conflict'; code: string }
    | { kind: 'retry' }
    | { kind: 'blocked'; code: 'invalid_body' | 'unknown_step' | 'rate_limited' | 'unavailable' }

export interface KycPlace {
    name: string
    region: string | null
}

export interface PaperworkVerificationDocument {
    type: string
    issuingCountry: string
}

/** What sign-up and verification collected (GET /users/kyc/details). */
export interface KycCollectedDetails {
    /** The name on the account: the verified one once KYC set it. */
    name: { first: string | null; last: string | null }
    /** The citizenship the ID check read, as Peanut records it. */
    citizenship: string | null
    /** The ID the check verified, as Peanut records it. */
    document: { type: string; country: string } | null
    /** The address Peanut stores from the earlier bank sign-up. */
    address: {
        line1: string
        line2: string | null
        city: string
        state: string | null
        postCode: string | null
        country: string
    } | null
    /** Collected, but only Sumsub holds them: the page shows them as not stored at Peanut. */
    heldBySumsub: string[]
}
