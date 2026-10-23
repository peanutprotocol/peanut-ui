import type { SumsubKycStatus } from './types/sumsub.types'
import { serverFetch } from '@/utils/api-fetch'
import { paperworkVerificationHeaders } from '@/features/paperwork-verification/paperworkVerificationHeaders'
import { providerRefusalsOf, type SetupRefusals } from '@/utils/kyc-setup-status.utils'
import { restartIdentityVerification, type SumsubActionErrorCode } from './sumsub'
import type {
    KycAttemptSession,
    KycDocumentPlan,
    KycFeatures,
    KycProfile,
    KycReplacementChoices,
} from './types/kyc-workflow.types'

async function read<T>(path: string, options?: RequestInit): Promise<T> {
    const response = await serverFetch(path, {
        ...options,
        headers: { ...paperworkVerificationHeaders(), ...(options?.headers as Record<string, string> | undefined) },
        cache: 'no-store',
        redactTelemetry: true,
    })
    if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw Object.assign(new Error('KYC request failed'), {
            code: body?.code ?? body?.error,
            feature: body?.feature,
        })
    }
    return response.json() as Promise<T>
}
export async function getKycDocumentPlan(restart = false): Promise<KycDocumentPlan> {
    const plan = await read<KycDocumentPlan>(`/users/kyc/plan${restart ? '?restart=true' : ''}`)
    if (typeof plan.available !== 'boolean' || !Array.isArray(plan.routes)) throw new Error('Invalid KYC plan')
    return plan
}
/** No plan means the legacy flow: an API without the route, a rollback or a failed read must not block KYC. */
export async function findKycDocumentPlan(): Promise<KycDocumentPlan | null> {
    try {
        return await getKycDocumentPlan()
    } catch {
        return null
    }
}
export function validSession(value: KycAttemptSession, documentRequired = true): KycAttemptSession {
    const identity = value?.sdkConfig?.documentDefinitions?.IDENTITY
    if (
        !value?.attemptId ||
        !value.token ||
        !value.applicantId ||
        (documentRequired &&
            (!identity?.country || !identity.idDocType || value.sdkConfig.autoSelectDocumentDefinitions !== true))
    )
        throw new Error('Invalid KYC verification session')
    return value
}
export type KycReplacementResult =
    | { kind: 'session'; session: KycAttemptSession }
    | { kind: 'failed'; error?: string; code?: SumsubActionErrorCode; cooldown?: { retryAt?: string } }

/** Restart an attempt-based identity on new documents. The API keeps the attempt's flow (Smart Paperwork Verification stays on it). */
export async function startKycDocumentReplacement(replacement: KycReplacementChoices): Promise<KycReplacementResult> {
    const response = await restartIdentityVerification(undefined, replacement)
    if (!response.data)
        return { kind: 'failed', error: response.error, code: response.code, cooldown: response.cooldown }
    try {
        return { kind: 'session', session: validSession(response.data as KycAttemptSession) }
    } catch {
        return { kind: 'failed', code: 'invalid_response' }
    }
}
export async function resumeKycDocumentAttempt(attemptId: string) {
    const response = await serverFetch(`/users/kyc/attempts/${encodeURIComponent(attemptId)}/token`, {
        method: 'POST',
        body: '{}',
        headers: paperworkVerificationHeaders(),
        cache: 'no-store',
        redactTelemetry: true,
    })
    const body = await response.json().catch(() => null)
    if (response.ok) return validSession(body, false)
    // A crash can leave the saved replacement before its remote reset. Only that explicit response resumes the authorised reset ledger.
    if (response.status === 409 && body?.error === 'replacement_reset_required')
        return validSession(await read<KycAttemptSession>('/users/identity/restart', { method: 'POST', body: '{}' }))
    throw Object.assign(new Error('KYC request failed'), { code: body?.code ?? body?.error })
}

/** Read-only fallback for a missed identity websocket event; never opens or refreshes an applicant. */
export async function getKycDocumentStatus(): Promise<SumsubKycStatus | undefined> {
    const profile = await read<{ identity: { canonicalStatus: string } | null }>('/users/kyc/profile')
    const status = profile.identity?.canonicalStatus
    if (
        status &&
        [
            'NOT_STARTED',
            'PENDING',
            'IN_REVIEW',
            'REVERIFYING',
            'APPROVED',
            'ACTION_REQUIRED',
            'REJECTED',
            'FAILED',
        ].includes(status)
    )
        return status as SumsubKycStatus
    return undefined
}

/** True when the current identity was verified through a verification attempt (Smart Paperwork Verification included). */
function attemptIdentity(profile: KycProfile): boolean {
    const identityId = profile.identity?.verificationId
    return (
        !!identityId &&
        profile.attempts.some(
            (attempt) =>
                attempt.kind === 'IDENTITY' && attempt.verificationId === identityId && attempt.status !== 'SUPERSEDED'
        )
    )
}

/**
 * The setup of an identity verified through a verification attempt: its saved
 * features and the plan's refusals. Null for every other identity, and when
 * a read fails (the identity status then shows as before).
 */
export async function findKycSetup(): Promise<{ features: KycFeatures; refusals: SetupRefusals } | null> {
    try {
        const [profile, plan] = await Promise.all([read<KycProfile>('/users/kyc/profile'), getKycDocumentPlan()])
        return attemptIdentity(profile)
            ? { features: plan.features, refusals: providerRefusalsOf(profile).refusals }
            : null
    } catch {
        return null
    }
}

/**
 * The restart plan of an identity verified through a verification attempt
 * while a policy is published: the API only restarts it on documents chosen
 * from this plan. Null for every other identity, which keeps the legacy restart.
 */
export async function getKycReplacementPlan(): Promise<KycDocumentPlan | null> {
    const [profile, plan] = await Promise.all([read<KycProfile>('/users/kyc/profile'), getKycDocumentPlan(true)])
    return attemptIdentity(profile) && plan.policyVersion && plan.available ? plan : null
}
/** A failed read keeps the legacy restart, whose own answer then shows. */
export async function findKycReplacementPlan(): Promise<KycDocumentPlan | null> {
    try {
        return await getKycReplacementPlan()
    } catch {
        return null
    }
}

/** The plan's refusals of the current identity's providers; null when the profile cannot be read. */
export async function findKycProviderRefusals(): Promise<ReturnType<typeof providerRefusalsOf> | null> {
    try {
        return providerRefusalsOf(await read<KycProfile>('/users/kyc/profile'))
    } catch {
        return null
    }
}
