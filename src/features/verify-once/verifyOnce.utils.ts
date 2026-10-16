import type { SumsubKycStatus } from '@/app/actions/types/sumsub.types'
import type { KycDocumentPlan } from '@/app/actions/types/kyc-workflow.types'
import type {
    VerifyOnceAnswers,
    VerifyOnceField,
    VerifyOnceQuestions,
    VerifyOnceStep,
    VerifyOnceStepId,
    VerifyOnceTaxFormat,
} from '@/app/actions/types/kyc-verify-once.types'
import { callingCodeFor, isE164 } from './callingCodes'

/** The server's next step when it names one, else the first one still open. */
export function resumeStep(questions: VerifyOnceQuestions): VerifyOnceStepId | null {
    if (questions.firstUnanswered && questions.steps.some((s) => s.id === questions.firstUnanswered))
        return questions.firstUnanswered
    return questions.steps.find((s) => !s.answered)?.id ?? null
}

/**
 * "Step n of m": sign-up counts as the done first step and the ID check as the
 * last, so the first question already shows progress made.
 */
export function stepProgress(questions: VerifyOnceQuestions, step: VerifyOnceStepId) {
    const total = questions.steps.length + 2
    const index = questions.steps.findIndex((s) => s.id === step)
    return { current: Math.max(index, 0) + 2, total }
}

/** The server's saved values; an empty phone starts with the residence's calling code, an unset toggle reads no. */
export const initialValues = (fields: VerifyOnceField[], residence: string | null = null): VerifyOnceAnswers =>
    Object.fromEntries(
        fields.map((f) => {
            if (f.value) return [f.key, f.value]
            if (f.kind === 'toggle') return [f.key, 'no']
            const code = f.kind === 'phone' ? callingCodeFor(residence) : null
            return [f.key, code ? `+${code} ` : '']
        })
    )

/** A field shows, and counts, only while the field it depends on has the value it names. */
export const isVisible = (field: VerifyOnceField, values: VerifyOnceAnswers) =>
    !field.visibleWhen || values[field.visibleWhen.key] === field.visibleWhen.equals

export const visibleFields = (fields: VerifyOnceField[], values: VerifyOnceAnswers) =>
    fields.filter((f) => isVisible(f, values))

/** What a step sends: trimmed, locked fields as the server gave them, empty optional and hidden fields left out. */
export function stepPayload(fields: VerifyOnceField[], values: VerifyOnceAnswers): VerifyOnceAnswers {
    const out: VerifyOnceAnswers = {}
    for (const field of visibleFields(fields, values)) {
        const raw = field.locked ? (field.value ?? '') : (values[field.key] ?? '')
        const value = field.kind === 'phone' ? raw.replace(/[\s()-]/g, '') : raw.trim()
        if (value) out[field.key] = value
    }
    return out
}

/** Continue waits for every required answer it can see; the server still checks each one. */
export const stepComplete = (fields: VerifyOnceField[], values: VerifyOnceAnswers) =>
    visibleFields(fields, values).every((f) => {
        const value = values[f.key]?.trim() ?? ''
        if (f.kind === 'phone' && value && !isE164(value)) return false
        if (f.kind === 'taxId' && looksLikeItin(f.format, value)) return false
        return !f.required || f.locked || !!value
    })

/** Add-later: the open steps of one feature, in the server's order. */
export const openSteps = (questions: VerifyOnceQuestions): VerifyOnceStep[] =>
    questions.steps.filter((s) => !s.answered)

const ERROR_KEYS: Record<string, string> = {
    required: 'required',
    invalid_option: 'invalidOption',
    invalid_tax_id: 'invalidTaxId',
    itin_not_accepted: 'itinNotAccepted',
    invalid_phone: 'invalidPhone',
    invalid_country: 'invalidCountry',
    too_long: 'tooLong',
    invalid_text: 'invalidText',
    us_citizen_not_supported: 'usCitizenNotSupported',
}

/** A server error code → its `kyc.verifyOnce.errors.*` key; an unknown code reads as a generic check-this-answer line. */
export const fieldErrorKey = (code: string) => ERROR_KEYS[code] ?? 'invalid'

const TAX_GROUPS: Partial<Record<NonNullable<VerifyOnceTaxFormat>, { groups: number[]; seps: string[] }>> = {
    ssn: { groups: [3, 2, 4], seps: ['-', '-'] },
    cuit: { groups: [2, 8, 1], seps: ['-', '-'] },
    cpf: { groups: [3, 3, 3, 2], seps: ['.', '.', '-'] },
}

/** Formats a tax number as it is typed, for the formats with a fixed digit pattern. */
export function formatTaxId(format: VerifyOnceTaxFormat | undefined, value: string): string {
    const spec = format ? TAX_GROUPS[format] : undefined
    if (!spec) return value
    const digits = value.replace(/\D/g, '').slice(
        0,
        spec.groups.reduce((a, b) => a + b, 0)
    )
    let out = ''
    let at = 0
    spec.groups.forEach((size, i) => {
        const part = digits.slice(at, at + size)
        if (!part) return
        out += (i > 0 ? spec.seps[i - 1] : '') + part
        at += size
    })
    return out
}

/** ITINs start with 9. Caught as it is typed; the server refuses it either way. */
export const looksLikeItin = (format: VerifyOnceTaxFormat | undefined, value: string) =>
    format === 'ssn' && /^9\d{8}$/.test(value.replace(/\D/g, ''))

export type VerifyPhase = 'id' | 'review' | 'verified' | 'address-proof'
export type VerifyStep = VerifyOnceStepId | VerifyPhase

export const IN_REVIEW_STATUSES = new Set<string>(['IN_REVIEW', 'REVERIFYING'])
export const FAILED_STATUSES = new Set<string>(['ACTION_REQUIRED', 'REJECTED', 'FAILED'])

/** Where a visit starts: approval and review win over the questions, the first open question over the midpoint. */
export function entryStep(
    {
        questions,
        plan,
        status,
    }: { questions: VerifyOnceQuestions; plan: KycDocumentPlan | null; status: SumsubKycStatus | undefined },
    submitted = false
): VerifyStep {
    if (status === 'APPROVED') return plan?.proofOfAddress === 'suggested' ? 'address-proof' : 'verified'
    if (submitted || (status && (IN_REVIEW_STATUSES.has(status) || FAILED_STATUSES.has(status)))) return 'review'
    return resumeStep(questions) ?? 'id'
}

/** The questions as GET would return them after a save, so Back shows what was saved. */
export function markSaved(
    questions: VerifyOnceQuestions,
    step: VerifyOnceStepId,
    values: VerifyOnceAnswers
): VerifyOnceQuestions {
    return {
        ...questions,
        steps: questions.steps.map((s) =>
            s.id === step
                ? {
                      ...s,
                      answered: true,
                      fields: s.fields.map((f) => (f.locked ? f : { ...f, value: values[f.key] ?? f.value })),
                  }
                : s
        ),
    }
}
