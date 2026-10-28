import type { SumsubKycStatus } from '@/app/actions/types/sumsub.types'
import type { KycDocumentPlan } from '@/app/actions/types/kyc-workflow.types'
import type {
    PaperworkVerificationAnswers,
    PaperworkVerificationClosedFeature,
    PaperworkVerificationFeature,
    PaperworkVerificationField,
    PaperworkVerificationFieldKind,
    PaperworkVerificationQuestions,
    PaperworkVerificationStep,
    PaperworkVerificationStepId,
    PaperworkVerificationTaxFormat,
} from '@/app/actions/types/kyc-paperwork-verification.types'
import { callingCodeFor, isE164 } from './callingCodes'

/** Accounts with its residence drawer open: where a verified user's move and its new check happen. */
/** ID document types → their names under `kyc.documents`. */
export const DOCUMENT_KEYS = {
    PASSPORT: 'passport',
    ID_CARD: 'idCard',
    DRIVERS: 'drivers',
    RESIDENCE_PERMIT: 'residencePermit',
    TEMPORARY_PROTECTION: 'temporaryProtection',
} as const

export const RESIDENCE_CHANGE_HREF = '/profile?open=residence'
export const PAYMENT_METHODS_HREF = '/profile/payments'

/** The server's next step when it names one, else the first one still open. */
export function resumeStep(questions: PaperworkVerificationQuestions): PaperworkVerificationStepId | null {
    if (questions.firstUnanswered && questions.steps.some((s) => s.id === questions.firstUnanswered))
        return questions.firstUnanswered
    return questions.steps.find((s) => !s.answered)?.id ?? null
}

/** Asked together, the phone shares the address screen; asked later on its own, it keeps its own screen. */
export function phoneJoinsAddress(questions: PaperworkVerificationQuestions): boolean {
    const address = questions.steps.find((s) => s.id === 'address')
    const phone = questions.steps.find((s) => s.id === 'phone')
    return !!address && !!phone && address.answered === phone.answered
}

/** A birth step that asks only the citizenship serves the ID picker, not a provider, so it says so. */
export const whyKeyOf = (step: { id: PaperworkVerificationStepId; features: string[] }) =>
    step.id === 'birth' && step.features.every((f) => f === 'base') ? ('citizenship' as const) : step.id

/** The citizenship the questions asked, saved or not; null when they did not ask. */
export const citizenshipOf = (questions: PaperworkVerificationQuestions): string | null =>
    questions.steps.flatMap((s) => s.fields).find((f) => f.key === 'citizenship')?.value ?? null

// Fields answered from a picker. They read as one sentence, so several steps of them share a screen.
const PICKER_KINDS = new Set<PaperworkVerificationFieldKind>(['choice', 'occupation', 'country', 'place'])
const MAX_PICKERS_PER_SCREEN = 6

/**
 * The question screens, in the server's order, each the ids of the steps it asks.
 * Steps answered only from pickers share a screen, up to six pickers, so the first
 * screen holds every picker step that fits even when inputs or toggle rows sit
 * between them; a step with text inputs or toggle rows keeps a screen of its own,
 * and a joined phone rides on the address screen. A screen is named by its first step.
 */
export function composeScreens(
    questions: PaperworkVerificationQuestions,
    phoneJoined: boolean
): PaperworkVerificationStepId[][] {
    const screens: PaperworkVerificationStepId[][] = []
    let pickers: { ids: PaperworkVerificationStepId[]; count: number } | null = null
    for (const step of questions.steps) {
        if (phoneJoined && step.id === 'phone') continue
        const pickerOnly = step.fields.length > 0 && step.fields.every((f) => PICKER_KINDS.has(f.kind))
        if (!pickerOnly) {
            screens.push(phoneJoined && step.id === 'address' ? ['address', 'phone'] : [step.id])
            continue
        }
        if (pickers && pickers.count + step.fields.length <= MAX_PICKERS_PER_SCREEN) {
            pickers.ids.push(step.id)
            pickers.count += step.fields.length
            continue
        }
        pickers = { ids: [step.id], count: step.fields.length }
        screens.push(pickers.ids)
    }
    return screens
}

/** The picked features less the ones the residence or an answer closed: what the ID check will set up. */
export const openFeatures = <F extends Partial<Record<PaperworkVerificationClosedFeature['feature'], boolean>>>(
    features: F | undefined,
    closed: PaperworkVerificationClosedFeature[] | undefined
): F | undefined => features && { ...features, ...Object.fromEntries((closed ?? []).map((c) => [c.feature, false])) }

/** The screen a step is asked on. */
export const screenOfStep = <S extends string>(
    screens: PaperworkVerificationStepId[][],
    step: S
): S | PaperworkVerificationStepId => screens.find((ids) => (ids as string[]).includes(step))?.[0] ?? step

/**
 * "Step n of m": sign-up counts as the done first step and the ID check as the
 * last, so the first question already shows progress made.
 */
export function stepProgress(screens: PaperworkVerificationStepId[], step: PaperworkVerificationStepId) {
    const total = screens.length + 2
    return { current: Math.max(screens.indexOf(step), 0) + 2, total }
}

/** The server's saved values; an empty phone starts with the residence's calling code, an unset toggle reads no. */
// The job-list entry a work status that is not a job stands for; there is no homemaker job.
const JOB_FROM_EMPLOYMENT_STATUS: Readonly<Record<string, string>> = {
    student: 'student',
    retired: 'retired',
    unemployed: 'unemployed',
    homemaker: 'unemployed',
}
/** Job-list entries that are a status, not a job. */
export const STATUS_JOBS: ReadonlySet<string> = new Set(Object.values(JOB_FROM_EMPLOYMENT_STATUS))

type WorkFields = Pick<PaperworkVerificationField, 'key' | 'everyStatus'>[]

/**
 * How the form asks the job, by work status (Slava, 2026-10-27): 'current' for
 * someone working or when no status is asked; 'last' for the retired, someone
 * not working or a homemaker; 'future' for a student. Those two only when Bridge
 * asks a job of every status; otherwise the status answers it ('none').
 */
export type JobMode = 'current' | 'last' | 'future' | 'none'
export function jobModeOf(fields: WorkFields, status: string | undefined): JobMode {
    const job = fields.find((f) => f.key === 'occupation')
    if (!job || !status || !fields.some((f) => f.key === 'employmentStatus') || !JOB_FROM_EMPLOYMENT_STATUS[status])
        return 'current'
    if (!job.everyStatus) return 'none'
    return status === 'student' ? 'future' : 'last'
}

/** The answer "no job to name" in each way of asking: a job-list entry Bridge files as not working. */
export const NO_JOB: Readonly<Partial<Record<JobMode, string>>> = { last: 'unemployed', future: 'student' }

/** The job a work status answers, when the form asks both and Bridge does not need a job of it. */
export const jobFromEmploymentStatus = (fields: WorkFields, status: string | undefined): string | null =>
    jobModeOf(fields, status) === 'none' ? JOB_FROM_EMPLOYMENT_STATUS[status!] : null

/** A job held for one way of asking, as the next way reads it: a status entry is no job anywhere. */
const jobFor = (mode: JobMode, job: string | undefined) =>
    job && STATUS_JOBS.has(job) ? (NO_JOB[mode] ?? '') : (job ?? '')

/** A changed work status updates the job it answers, and reads a "no job" answer the new way. */
export function withEmploymentStatus(
    fields: WorkFields,
    values: PaperworkVerificationAnswers,
    status: string
): PaperworkVerificationAnswers {
    const next: PaperworkVerificationAnswers = { ...values, employmentStatus: status }
    if (!fields.some((f) => f.key === 'occupation') || !fields.some((f) => f.key === 'employmentStatus')) return next
    const job = jobFromEmploymentStatus(fields, status)
    next.occupation = job ?? jobFor(jobModeOf(fields, status), values.occupation)
    return next
}

export const initialValues = (
    fields: PaperworkVerificationField[],
    residence: string | null = null
): PaperworkVerificationAnswers => {
    const values: PaperworkVerificationAnswers = Object.fromEntries(
        fields.map((f) => {
            if (f.value) return [f.key, f.value]
            if (f.kind === 'toggle') return [f.key, 'no']
            const code = f.kind === 'phone' ? callingCodeFor(residence) : null
            return [f.key, code ? `+${code} ` : '']
        })
    )
    const job = jobFromEmploymentStatus(fields, values.employmentStatus)
    if (job) return values.occupation ? values : { ...values, occupation: job }
    // Bridge files "no job" under one code, read back as any status entry: show it as this screen's own.
    const mode = jobModeOf(fields, values.employmentStatus)
    return NO_JOB[mode] && values.occupation ? { ...values, occupation: jobFor(mode, values.occupation) } : values
}

/**
 * A saved value the server shows masked (the tax number as `•••• 1234`), not typed over. The
 * value check stands in for an API that drops the `masked` flag: a masked value must never be sent.
 */
export const maskedUntouched = (field: PaperworkVerificationField, values: PaperworkVerificationAnswers) =>
    !!field.value &&
    (field.masked === true || (field.kind === 'taxId' && field.value.startsWith('•'))) &&
    (values[field.key] ?? field.value) === field.value

/** What a step sends: trimmed, locked fields as given, empty optional and untouched masked fields left out. */
export function stepPayload(
    fields: PaperworkVerificationField[],
    values: PaperworkVerificationAnswers
): PaperworkVerificationAnswers {
    const out: PaperworkVerificationAnswers = {}
    for (const field of fields) {
        if (maskedUntouched(field, values)) continue
        const raw = field.locked ? (field.value ?? '') : (values[field.key] ?? '')
        const value = field.kind === 'phone' ? raw.replace(/[\s()-]/g, '') : raw.trim()
        if (value) out[field.key] = value
    }
    return out
}

/** An answered step still holding the values it was saved with. */
export const stepUnchanged = (step: PaperworkVerificationStep, values: PaperworkVerificationAnswers) =>
    step.answered &&
    step.fields.every(
        (f) => (stepPayload([f], values)[f.key] ?? '') === (stepPayload([f], { [f.key]: f.value ?? '' })[f.key] ?? '')
    )

/** Continue waits for every required answer and none the screen refuses; the server still checks each one. */
export const stepComplete = (
    fields: PaperworkVerificationField[],
    values: PaperworkVerificationAnswers,
    refused: ReadonlySet<string> = new Set()
) =>
    fields.every((f) => {
        const value = values[f.key]?.trim() ?? ''
        if (refused.has(f.key)) return false
        if (f.kind === 'phone' && value && !isE164(value)) return false
        if (f.kind === 'taxId' && looksLikeItin(f.format, value)) return false
        return !f.required || f.locked || !!value
    })

/** Add-later: the open steps of one feature, in the server's order. */
export const openSteps = (questions: PaperworkVerificationQuestions): PaperworkVerificationStep[] =>
    questions.steps.filter((s) => !s.answered)

const ERROR_KEYS: Record<string, string> = {
    required: 'required',
    invalid_option: 'invalidOption',
    invalid_tax_id: 'invalidTaxId',
    itin_not_accepted: 'itinNotAccepted',
    invalid_phone: 'invalidPhone',
    invalid_country: 'invalidCountry',
    too_long: 'tooLong',
    too_short: 'tooShort',
    street_number_missing: 'streetNumberMissing',
    po_box_not_accepted: 'poBoxNotAccepted',
    invalid_text: 'invalidText',
    us_citizen_not_supported: 'usCitizenNotSupported',
}

/** A server error code → its `kyc.paperworkVerification.errors.*` key; an unknown code reads as a generic check-this-answer line. */
export const fieldErrorKey = (code: string) => ERROR_KEYS[code] ?? 'invalid'

const TAX_GROUPS: Partial<Record<NonNullable<PaperworkVerificationTaxFormat>, { groups: number[]; seps: string[] }>> = {
    ssn: { groups: [3, 2, 4], seps: ['-', '-'] },
    cuit: { groups: [2, 8, 1], seps: ['-', '-'] },
    cpf: { groups: [3, 3, 3, 2], seps: ['.', '.', '-'] },
}

/** Formats a tax number as it is typed, for the formats with a fixed digit pattern. */
export function formatTaxId(format: PaperworkVerificationTaxFormat | undefined, value: string): string {
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
export const looksLikeItin = (format: PaperworkVerificationTaxFormat | undefined, value: string) =>
    format === 'ssn' && /^9\d{8}$/.test(value.replace(/\D/g, ''))

export type VerifyPhase = 'saved' | 'id' | 'review' | 'verified' | 'address-proof'
export type VerifyStep = PaperworkVerificationStepId | VerifyPhase

// REVERIFYING is an approved user's selfie re-check; the API counts it as approved.
export const APPROVED_STATUSES = new Set<string>(['APPROVED', 'REVERIFYING'])
export const IN_REVIEW_STATUSES = new Set<string>(['PENDING', 'IN_REVIEW'])
export const FAILED_STATUSES = new Set<string>(['ACTION_REQUIRED', 'REJECTED', 'FAILED'])
// FAILED is our check erroring with nothing decided; only REJECTED is final.
export const RETRYABLE_STATUSES = new Set<string>(['ACTION_REQUIRED', 'FAILED'])

/**
 * A question still open after approval (the nationality an EEA bank account needs when the ID
 * names none) is that feature's add-later question: the feature to ask it for, if any.
 */
export function featureOpenAfterApproval(
    questions: PaperworkVerificationQuestions,
    status: SumsubKycStatus | undefined
): PaperworkVerificationFeature | null {
    if (!status || !APPROVED_STATUSES.has(status)) return null
    for (const step of questions.steps) {
        const feature = step.answered ? undefined : step.features.find((f) => f !== 'base')
        if (feature) return feature
    }
    return null
}

/** Where a visit starts: approval and review win over the questions, the first open question over the midpoint. */
export function entryStep(
    {
        questions,
        plan,
        status,
    }: { questions: PaperworkVerificationQuestions; plan: KycDocumentPlan | null; status: SumsubKycStatus | undefined },
    submitted = false
): VerifyStep {
    if (status && APPROVED_STATUSES.has(status))
        return plan?.proofOfAddress === 'suggested' ? 'address-proof' : 'verified'
    if (submitted || (status && (IN_REVIEW_STATUSES.has(status) || FAILED_STATUSES.has(status)))) return 'review'
    return resumeStep(questions) ?? 'id'
}

/** The questions as GET would return them after a save, so Back shows what was saved. */
export function markSaved(
    questions: PaperworkVerificationQuestions,
    step: PaperworkVerificationStepId,
    values: PaperworkVerificationAnswers
): PaperworkVerificationQuestions {
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
