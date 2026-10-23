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
