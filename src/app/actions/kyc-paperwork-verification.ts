import { savedFeaturesOutcome } from '@/utils/kyc-feature-outcome.utils'
import { serverFetch } from '@/utils/api-fetch'
import { kycClientHeaders } from '@/utils/kyc-client-headers'
import { validSession } from './kyc-workflow'
import type { KycAttemptSession, KycFeatures, KycFeatureReports } from './types/kyc-workflow.types'
import type {
    KycCollectedDetails,
    KycPlace,
    SaveAnswersResult,
    PaperworkVerificationAnswers,
    PaperworkVerificationDocument,
    PaperworkVerificationFeature,
    PaperworkVerificationQuestions,
    PaperworkVerificationStepId,
} from './types/kyc-paperwork-verification.types'

const featureQuery = (feature?: PaperworkVerificationFeature) => (feature ? `?feature=${feature}` : '')

// Answers carry tax numbers and addresses: never in telemetry, never cached.
const call = (path: string, init?: RequestInit) =>
    serverFetch(path, { ...init, headers: kycClientHeaders(), cache: 'no-store', redactTelemetry: true })

const json = (response: Response) => response.json().catch(() => null)

/** A refusal's stable code; older API bodies name it `error`. */
const codeOf = (body: { code?: unknown; error?: unknown } | null): string | null => {
    const code = body?.code ?? body?.error
    return typeof code === 'string' ? code : null
}

/** The server's user-facing line for a refusal, when it sends one. */
const userMessageOf = (body: { userMessage?: unknown } | null): { message?: string } =>
    typeof body?.userMessage === 'string' && body.userMessage.trim() ? { message: body.userMessage } : {}

export async function skipProofOfAddress(): Promise<boolean> {
    try {
        const response = await call('/users/kyc/proof-of-address/skip', { method: 'POST', body: '{}' })
        return response.ok
    } catch {
        return false
    }
}

/** What sign-up and verification collected, for Profile; throws when it cannot be read. */
export async function getKycDetails(): Promise<KycCollectedDetails> {
    const response = await call('/users/kyc/details')
    const body = response.ok ? await json(response) : null
    if (!body || !Array.isArray(body.heldBySumsub)) throw new Error('KYC details unavailable')
    return body as KycCollectedDetails
}

/** Places of birth to suggest; an empty list on any failure, since the typed name is accepted as it is. */
export async function searchKycPlaces(country: string, query: string): Promise<KycPlace[]> {
    try {
        const response = await call('/users/kyc/places/search', {
            method: 'POST',
            body: JSON.stringify({ country, query }),
        })
        const body = response.ok ? await json(response) : null
        return Array.isArray(body?.places) ? body.places : []
    } catch {
        return []
    }
}

export async function getKycQuestions(feature?: PaperworkVerificationFeature): Promise<PaperworkVerificationQuestions> {
    const response = await call(`/users/kyc/questions${featureQuery(feature)}`)
    const body = response.ok ? await json(response) : null
    if (!body || typeof body.available !== 'boolean' || !Array.isArray(body.steps))
        throw new Error('KYC questions unavailable')
    return body as PaperworkVerificationQuestions
}

/** Every outcome the screen acts on; a network failure or a 5xx is a retry, never a lost answer. */
export async function saveKycAnswers(
    step: PaperworkVerificationStepId,
    values: PaperworkVerificationAnswers,
    feature?: PaperworkVerificationFeature
): Promise<SaveAnswersResult> {
    let response: Response
    try {
        response = await call(`/users/kyc/answers/${step}${featureQuery(feature)}`, {
            method: 'PUT',
            body: JSON.stringify({ values }),
        })
    } catch {
        return { kind: 'retry' }
    }
    const body = await json(response)
    if (response.ok) return { kind: 'saved', next: body?.next ?? null }
    if (response.status === 422 && body?.errors && typeof body.errors === 'object')
        return { kind: 'invalid', errors: body.errors }
    const code = codeOf(body)
    if (response.status === 409 && code) return { kind: 'conflict', code, ...userMessageOf(body) }
    if (response.status === 429) return { kind: 'blocked', code: 'rate_limited' }
    if (response.status === 400)
        return {
            kind: 'blocked',
            code: codeOf(body) === 'unknown_step' ? 'unknown_step' : 'invalid_body',
        }
    if (response.status === 404) return { kind: 'blocked', code: 'unknown_step' }
    if (response.status >= 400 && response.status < 500) return { kind: 'blocked', code: 'unavailable' }
    return { kind: 'retry' }
}

export type PaperworkVerificationTokenResult =
    | { kind: 'session'; session: KycAttemptSession }
    | { kind: 'document-required'; message?: string }
    /** the picked document is not one the attempt offers */
    | { kind: 'document-not-allowed'; message?: string }
    | { kind: 'questions-missing'; step: PaperworkVerificationStepId | null; message?: string }
    /** the ID is already submitted or the check is over: the status has moved on */
    | { kind: 'complete'; message?: string }
    | { kind: 'failed'; message?: string }

export async function startPaperworkVerificationIdentity(
    attemptId: string,
    document?: PaperworkVerificationDocument
): Promise<PaperworkVerificationTokenResult> {
    let response: Response
    try {
        response = await call(`/users/kyc/attempts/${encodeURIComponent(attemptId)}/token`, {
            method: 'POST',
            body: JSON.stringify({ document }),
        })
    } catch {
        return { kind: 'failed' }
    }
    const body = await json(response)
    const message = userMessageOf(body)
    if (response.status === 409) {
        const code = codeOf(body)
        if (code === 'questions_missing') return { kind: 'questions-missing', step: body.step ?? null, ...message }
        if (code === 'document_required') return { kind: 'document-required', ...message }
        if (code === 'document_not_allowed') return { kind: 'document-not-allowed', ...message }
        if (code === 'verification_complete' || code === 'identity_submitted') return { kind: 'complete', ...message }
    }
    if (!response.ok) return { kind: 'failed', ...message }
    try {
        return { kind: 'session', session: validSession(body, !!document) }
    } catch {
        return { kind: 'failed' }
    }
}

export type FeatureIntentsResult =
    | { kind: 'saved' }
    | { kind: 'ready' }
    | { kind: 'action-required'; action: string }
    | { kind: 'card-application' }
    | { kind: 'refused'; feature: keyof KycFeatures; copy: string }
    | { kind: 'questions-missing'; step: PaperworkVerificationStepId | null }
    | { kind: 'failed' }

/** Saves the feature set after add-later; a feature whose answers are still missing is refused with its step. */
export async function savePaperworkVerificationFeatures(
    features: KycFeatures,
    before: KycFeatures = { qr: false, bank: false, local: false, card: false }
): Promise<FeatureIntentsResult> {
    let response: Response
    try {
        response = await call('/users/kyc-intents', { method: 'PUT', body: JSON.stringify(features) })
    } catch {
        return { kind: 'failed' }
    }
    const body = await json(response)
    if (response.ok) {
        const outcome = savedFeaturesOutcome(features, before, body?.features as KycFeatureReports | undefined)
        if (outcome && 'action' in outcome) return { kind: 'action-required', action: outcome.action }
        if (outcome && 'copy' in outcome) return { kind: 'refused', ...outcome }
        const owed = (Object.keys(features) as (keyof KycFeatures)[]).find(
            (key) => features[key] && body?.features?.[key]?.state === 'action_required'
        )
        // The card is allowed and owes only its own application (the card questions and agreement on /card).
        if (owed === 'card') return { kind: 'card-application' }
        if (owed) return { kind: 'refused', feature: owed, copy: 'supplement.unavailable' }
        if (outcome && 'ready' in outcome) return { kind: 'ready' }
        return { kind: 'saved' }
    }
    if (response.status === 409 && codeOf(body) === 'questions_missing')
        return { kind: 'questions-missing', step: body.step ?? null }
    return { kind: 'failed' }
}
