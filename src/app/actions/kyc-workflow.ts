import type { SumsubKycStatus } from './types/sumsub.types'
import { serverFetch } from '@/utils/api-fetch'
import type { KycAttemptSession, KycDocumentPlan, KycDocumentChoice, KycFeatures } from './types/kyc-workflow.types'

async function read<T>(path: string, options?: RequestInit): Promise<T> {
    const response = await serverFetch(path, { ...options, cache: 'no-store', redactTelemetry: true })
    if (!response.ok) throw new Error('KYC request failed')
    return response.json() as Promise<T>
}
export async function getKycDocumentPlan(restart = false): Promise<KycDocumentPlan> {
    const plan = await read<KycDocumentPlan>(`/users/kyc/plan${restart ? '?restart=true' : ''}`)
    if (typeof plan.available !== 'boolean' || !Array.isArray(plan.routes)) throw new Error('Invalid KYC plan')
    return plan
}
export async function saveKycFeatures(features: KycFeatures, restart = false) {
    await read('/users/kyc-intents', { method: 'PUT', body: JSON.stringify(features) })
    return getKycDocumentPlan(restart)
}
function validSession(value: KycAttemptSession): KycAttemptSession {
    const identity = value.sdkConfig?.documentDefinitions?.IDENTITY
    if (
        !value.attemptId ||
        !value.token ||
        !value.applicantId ||
        !identity?.country ||
        !identity.idDocType ||
        value.sdkConfig.autoSelectDocumentDefinitions !== true
    )
        throw new Error('Invalid KYC verification session')
    return value
}
export async function startKycDocumentAttempt(input: {
    requestKey: string
    policyVersion: string
    routeId: string
    documents: KycDocumentChoice[]
}) {
    return validSession(
        await read<KycAttemptSession>('/users/kyc/attempts', { method: 'POST', body: JSON.stringify(input) })
    )
}
export async function startKycDocumentReplacement(input: {
    requestKey: string
    policyVersion: string
    routeId: string
    documents: KycDocumentChoice[]
}) {
    return validSession(
        await read<KycAttemptSession>('/users/identity/restart', {
            method: 'POST',
            body: JSON.stringify({ replacement: input }),
        })
    )
}
export async function resumeKycDocumentAttempt(attemptId: string) {
    const response = await serverFetch(`/users/kyc/attempts/${encodeURIComponent(attemptId)}/token`, {
        method: 'POST',
        body: '{}',
        cache: 'no-store',
        redactTelemetry: true,
    })
    const body = await response.json()
    if (response.ok) return validSession(body)
    // A crash can leave the saved replacement before its remote reset. Only that explicit response resumes the authorised reset ledger.
    if (response.status === 409 && body?.error === 'replacement_reset_required')
        return validSession(await read<KycAttemptSession>('/users/identity/restart', { method: 'POST', body: '{}' }))
    throw new Error('KYC request failed')
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
