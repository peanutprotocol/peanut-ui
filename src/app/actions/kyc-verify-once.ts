import { serverFetch } from '@/utils/api-fetch'
import { verifyOnceHeaders } from '@/features/verify-once/verifyOnceFlag'
import { validSession } from './kyc-workflow'
import type { KycAttemptSession, KycFeatures } from './types/kyc-workflow.types'
import type {
    SaveAnswersResult,
    VerifyOnceAnswers,
    VerifyOnceDocument,
    VerifyOnceFeature,
    VerifyOnceQuestions,
    VerifyOnceStepId,
} from './types/kyc-verify-once.types'

const featureQuery = (feature?: VerifyOnceFeature) => (feature ? `?feature=${feature}` : '')

// Answers carry tax numbers and addresses: never in telemetry, never cached.
const call = (path: string, init?: RequestInit) =>
    serverFetch(path, { ...init, headers: verifyOnceHeaders(), cache: 'no-store', redactTelemetry: true })

const json = (response: Response) => response.json().catch(() => null)

export async function skipProofOfAddress(): Promise<boolean> {
    try {
        const response = await call('/users/kyc/proof-of-address/skip', { method: 'POST', body: '{}' })
        return response.ok
    } catch {
        return false
    }
}

export async function getKycQuestions(feature?: VerifyOnceFeature): Promise<VerifyOnceQuestions> {
    const response = await call(`/users/kyc/questions${featureQuery(feature)}`)
    const body = response.ok ? await json(response) : null
    if (!body || typeof body.available !== 'boolean' || !Array.isArray(body.steps))
        throw new Error('KYC questions unavailable')
    return body as VerifyOnceQuestions
}

/** Every outcome the screen acts on; a network failure or a 5xx is a retry, never a lost answer. */
export async function saveKycAnswers(
    step: VerifyOnceStepId,
    values: VerifyOnceAnswers,
    feature?: VerifyOnceFeature
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
    if (response.status === 409 && typeof body?.code === 'string') return { kind: 'conflict', code: body.code }
    return { kind: 'retry' }
}

export type VerifyOnceTokenResult =
    | { kind: 'session'; session: KycAttemptSession }
    | { kind: 'questions-missing'; step: VerifyOnceStepId | null }
    | { kind: 'failed' }

export async function startVerifyOnceIdentity(
    attemptId: string,
    document: VerifyOnceDocument
): Promise<VerifyOnceTokenResult> {
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
    if (response.status === 409 && body?.code === 'questions_missing')
        return { kind: 'questions-missing', step: body.step ?? null }
    if (!response.ok) return { kind: 'failed' }
    try {
        return { kind: 'session', session: validSession(body) }
    } catch {
        return { kind: 'failed' }
    }
}

export type FeatureIntentsResult =
    | { kind: 'saved' }
    | { kind: 'questions-missing'; step: VerifyOnceStepId | null }
    | { kind: 'failed' }

/** Saves the feature set after add-later; a feature whose answers are still missing is refused with its step. */
export async function saveVerifyOnceFeatures(features: KycFeatures): Promise<FeatureIntentsResult> {
    let response: Response
    try {
        response = await call('/users/kyc-intents', { method: 'PUT', body: JSON.stringify(features) })
    } catch {
        return { kind: 'failed' }
    }
    if (response.ok) return { kind: 'saved' }
    const body = await json(response)
    if (response.status === 409 && body?.code === 'questions_missing')
        return { kind: 'questions-missing', step: body.step ?? null }
    return { kind: 'failed' }
}
