// Typed by hand from the frozen api#1816 contract until the API types are regenerated.

export type VerifyOnceStepId = 'purpose' | 'work' | 'money' | 'birth' | 'address' | 'phone' | 'declarations' | 'tax'
export type VerifyOnceFeature = 'bank' | 'card' | 'local'
export type VerifyOnceFieldKind = 'choice' | 'occupation' | 'country' | 'place' | 'text' | 'phone' | 'taxId' | 'toggle'
export type VerifyOnceTaxFormat = 'ssn' | 'cuit' | 'cpf' | 'rut' | 'curp' | 'cc' | null

export interface VerifyOnceField {
    key: string
    kind: VerifyOnceFieldKind
    required: boolean
    options?: string[]
    format?: VerifyOnceTaxFormat
    locked?: boolean
    /** A `place` field suggests places of the country this field of the step holds. */
    countryField?: string
    /** Shown, and required, only while another field of the step has this value. */
    visibleWhen?: { key: string; equals: string }
    /** A toggle's value is 'yes' or 'no'. */
    value: string | null
}

export interface VerifyOnceStep {
    id: VerifyOnceStepId
    features: Array<'base' | VerifyOnceFeature>
    fields: VerifyOnceField[]
    answered: boolean
}

export interface VerifyOnceQuestions {
    available: boolean
    attemptId: string | null
    residence: string | null
    steps: VerifyOnceStep[]
    firstUnanswered: VerifyOnceStepId | null
    progress: { done: number; total: number }
}

export type VerifyOnceAnswers = Record<string, string>

export type SaveAnswersResult =
    | { kind: 'saved'; next: VerifyOnceStepId | null }
    | { kind: 'invalid'; errors: Record<string, string> }
    | { kind: 'conflict'; code: string }
    | { kind: 'retry' }

export interface KycPlace {
    name: string
    region: string | null
}

export interface VerifyOnceDocument {
    type: string
    issuingCountry: string
}
