import type { IUserProfile } from '@/interfaces/interfaces'
import type { SumsubKycStatus } from '@/app/actions/types/sumsub.types'
import type { KycDocumentPlan } from '@/app/actions/types/kyc-workflow.types'
import type {
    PaperworkVerificationAnswers,
    PaperworkVerificationField,
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

/** The citizenship the questions asked (Bridge's EEA nationality), saved or not; null when they did not ask. */
export const citizenshipOf = (questions: PaperworkVerificationQuestions): string | null =>
    questions.steps.flatMap((s) => s.fields).find((f) => f.key === 'nationality')?.value ?? null

/** The steps that get a screen of their own, in the server's order. */
export const screenIds = (
    questions: PaperworkVerificationQuestions,
    phoneJoined: boolean
): PaperworkVerificationStepId[] => questions.steps.map((s) => s.id).filter((id) => !(phoneJoined && id === 'phone'))

/**
 * "Step n of m": sign-up counts as the done first step and the ID check as the
 * last, so the first question already shows progress made.
 */
export function stepProgress(screens: PaperworkVerificationStepId[], step: PaperworkVerificationStepId) {
    const total = screens.length + 2
    return { current: Math.max(screens.indexOf(step), 0) + 2, total }
}

/** The server's saved values; an empty phone starts with the residence's calling code, an unset toggle reads no. */
export const initialValues = (
    fields: PaperworkVerificationField[],
    residence: string | null = null
): PaperworkVerificationAnswers =>
    Object.fromEntries(
        fields.map((f) => {
            if (f.value) return [f.key, f.value]
            if (f.kind === 'toggle') return [f.key, 'no']
            const code = f.kind === 'phone' ? callingCodeFor(residence) : null
            return [f.key, code ? `+${code} ` : '']
        })
    )

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
