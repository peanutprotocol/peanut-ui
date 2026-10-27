import type { IUserProfile } from '@/interfaces/interfaces'
import type { SumsubKycStatus } from '@/app/actions/types/sumsub.types'
import type { KycDocumentPlan } from '@/app/actions/types/kyc-workflow.types'
import type {
    PaperworkVerificationAnswers,
    PaperworkVerificationClosedFeature,
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

/**
 * Temporary protection is for people displaced from Ukraine: offered only to an
 * account tied to it by citizenship, a residence, or where it signed up from
 * (Slava, 2026-10-26).
 */
export function linkedToUkraine(
    citizenship: string | null,
    user: Pick<IUserProfile, 'residence' | 'geo'> | null | undefined,
    residence: string | null = null
): boolean {
    const r = user?.residence
    const signup = user?.geo?.signup
    return [
        citizenship,
        residence,
        r?.verified?.country,
        r?.declared?.country,
        r?.declared?.secondCountry,
        r?.secondaryDeclaredCountry,
        signup?.vercelIp?.country,
        signup?.ipProvider?.country,
        signup?.store?.country,
    ].some((country) => country?.toUpperCase() === 'UA')
}

export const RESIDENCE_CHANGE_HREF = '/profile/accounts?open=residence'

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
    questions.steps.flatMap((s) => s.fields).find((f) => f.key === 'nationality')?.value ?? null

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
// A status that is also an entry of the job list answers the job question too.
const JOB_FROM_EMPLOYMENT_STATUS: Readonly<Record<string, string>> = {
    student: 'student',
    retired: 'retired',
    unemployed: 'unemployed',
}

/** The job a work status answers, when the form asks both. */
export const jobFromEmploymentStatus = (
    fields: Pick<PaperworkVerificationField, 'key'>[],
    status: string | undefined
): string | null =>
    status && fields.some((f) => f.key === 'occupation') && fields.some((f) => f.key === 'employmentStatus')
        ? (JOB_FROM_EMPLOYMENT_STATUS[status] ?? null)
        : null

/** A changed work status updates the job it answers, and drops one it no longer answers. */
export function withEmploymentStatus(
    fields: Pick<PaperworkVerificationField, 'key'>[],
    values: PaperworkVerificationAnswers,
    status: string
): PaperworkVerificationAnswers {
    const next: PaperworkVerificationAnswers = { ...values, employmentStatus: status }
    const job = jobFromEmploymentStatus(fields, status)
    if (job) next.occupation = job
    else if (jobFromEmploymentStatus(fields, values.employmentStatus) === values.occupation) next.occupation = ''
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
    return job && !values.occupation ? { ...values, occupation: job } : values
}

/** What a step sends: trimmed, locked fields as the server gave them, empty optional fields left out. */
export function stepPayload(
    fields: PaperworkVerificationField[],
    values: PaperworkVerificationAnswers
): PaperworkVerificationAnswers {
    const out: PaperworkVerificationAnswers = {}
    for (const field of fields) {
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

/** Continue waits for every required answer; the server still checks each one. */
export const stepComplete = (fields: PaperworkVerificationField[], values: PaperworkVerificationAnswers) =>
    fields.every((f) => {
        const value = values[f.key]?.trim() ?? ''
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

export const IN_REVIEW_STATUSES = new Set<string>(['PENDING', 'IN_REVIEW', 'REVERIFYING'])
export const FAILED_STATUSES = new Set<string>(['ACTION_REQUIRED', 'REJECTED', 'FAILED'])

/** Where a visit starts: approval and review win over the questions, the first open question over the midpoint. */
export function entryStep(
    {
        questions,
        plan,
        status,
    }: { questions: PaperworkVerificationQuestions; plan: KycDocumentPlan | null; status: SumsubKycStatus | undefined },
    submitted = false
): VerifyStep {
    if (status === 'APPROVED') return plan?.proofOfAddress === 'suggested' ? 'address-proof' : 'verified'
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
