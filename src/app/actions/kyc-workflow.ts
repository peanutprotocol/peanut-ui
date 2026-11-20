import posthog from 'posthog-js'
import type { SumsubKycStatus } from './types/sumsub.types'
import { serverFetch } from '@/utils/api-fetch'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { kycClientHeaders } from '@/utils/kyc-client-headers'
import { restartIdentityVerification, type SumsubActionErrorCode } from './sumsub'
import * as Sentry from '@/utils/sentry-lazy'
import { criticalFlowTags } from '@/utils/sentry-critical-flow'
import type { FeatureReport } from '@/types/capabilities'
import { isTestApiBuild, reportApiContractError } from '@/utils/api-contracts'
import { featureReverificationConflict, isFeatureReverificationEntry } from '@/utils/kyc-reverification'
import type {
    FeatureReverificationRefreshNotActive,
    FeatureReverificationStatus,
    KycPlanFeature,
} from './types/kyc-reverification.types'
import {
    PAPERWORK_VERIFICATION_FLOW,
    type KycAttemptSession,
    type KycDocumentPlan,
    type KycProfile,
    type KycReplacementChoices,
} from './types/kyc-workflow.types'

type GuardedRequest = RequestInit & { beforeDispatch?: () => boolean }
const ATTEMPT_NOT_ACTIVE: FeatureReverificationRefreshNotActive['code'] = 'attempt_not_active'

async function readResponse<T>(path: string, options?: GuardedRequest): Promise<T> {
    const response = await serverFetch(path, {
        ...options,
        ...(options?.signal && {
            beforeDispatch: () => !options.signal!.aborted && (options.beforeDispatch?.() ?? true),
        }),
        headers: { ...kycClientHeaders(), ...(options?.headers as Record<string, string> | undefined) },
        cache: 'no-store',
        redactTelemetry: true,
    })
    const body: unknown = await response.json().catch(() => null)
    const object = body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : null
    // The API before addendum 1 returned an empty body for an archived candidate.
    if (
        response.status === 404 &&
        path.startsWith('/users/kyc/identity/refresh?attemptId=') &&
        (body === null || (object && Object.keys(object).length === 0))
    )
        throw Object.assign(new Error('KYC attempt no longer active'), { code: ATTEMPT_NOT_ACTIVE, status: 404 })
    if (
        (response.status === 404 &&
            (object?.code === 'route_not_found' ||
                !(typeof object?.error === 'string' || typeof object?.code === 'string'))) ||
        (response.ok && !object)
    )
        throw contractError(
            path,
            options?.method ?? 'GET',
            response.status,
            object?.code === 'route_not_found' ? 'route_not_found' : 'invalid_response'
        )
    if (!response.ok) {
        const reverification = featureReverificationConflict(response.status, object)
        throw Object.assign(new Error('KYC request failed'), {
            code: object?.code ?? object?.error,
            userMessage: typeof object?.userMessage === 'string' ? object.userMessage : undefined,
            feature: object?.feature,
            status: response.status,
            ...(reverification && { entry: reverification.entry }),
        })
    }
    return body as T
}
async function read<T>(path: string, options?: GuardedRequest): Promise<T> {
    try {
        return await readResponse<T>(path, options)
    } catch (error) {
        if (options?.signal?.aborted) throw error
        const failure = error as { status?: number; code?: string }
        if (
            !path.startsWith('/users/kyc/identity/refresh') &&
            failure?.code !== API_CONTRACT_ERROR &&
            !(failure?.status !== undefined && failure.status >= 400 && failure.status < 500)
        ) {
            const step = path.startsWith('/users/kyc/plan')
                ? 'plan_read'
                : path === '/users/kyc/features'
                  ? 'features_read'
                  : path === '/users/identity/restart'
                    ? 'identity_restart'
                    : 'identity_status'
            Sentry.captureException(failure?.status === undefined ? error : new Error('KYC request failed'), {
                tags: { ...criticalFlowTags('kyc'), kyc_step: step },
            })
        }
        throw error
    }
}
const API_CONTRACT_ERROR = 'api_contract_error'
function contractError(path: string, method: string, status: number, reason: string): Error {
    reportApiContractError(path.split('?')[0], method, reason, status)
    return Object.assign(new Error('API contract error'), { code: API_CONTRACT_ERROR, status })
}
const KNOWN_STATUSES = new Set([
    'NOT_STARTED',
    'PENDING',
    'IN_REVIEW',
    'REVERIFYING',
    'APPROVED',
    'ACTION_REQUIRED',
    'REJECTED',
    'FAILED',
])

export async function getKycDocumentPlan(
    restart = false,
    signal?: AbortSignal,
    feature?: KycPlanFeature,
    attemptId?: string
): Promise<KycDocumentPlan> {
    const query = new URLSearchParams()
    if (restart) query.set('restart', 'true')
    if (feature) query.set('feature', feature)
    if (attemptId) query.set('attemptId', attemptId)
    const search = query.toString()
    const plan = await read<KycDocumentPlan>(`/users/kyc/plan${search ? `?${search}` : ''}`, { signal })
    if (
        typeof plan.available !== 'boolean' ||
        !Array.isArray(plan.routes) ||
        (plan.flow !== null && plan.flow !== PAPERWORK_VERIFICATION_FLOW && !plan.unavailableReason) ||
        (plan.unavailableReason !== undefined &&
            (plan.available || plan.unavailableReason !== 'residence_not_supported')) ||
        (plan.entry != null && !isFeatureReverificationEntry(plan.entry))
    )
        throw contractError('/users/kyc/plan', 'GET', 200, 'invalid_plan')
    return plan
}

/** The API's feature report (`GET /users/kyc/features`); undefined when it cannot be read. */
export async function getKycFeatures(signal?: AbortSignal): Promise<FeatureReport | undefined> {
    try {
        return (await read<{ features?: FeatureReport }>('/users/kyc/features', signal ? { signal } : undefined))
            .features
    } catch {
        return undefined
    }
}

/** Waits before the 2nd and 3rd tries: Android WebView GETs fail intermittently (POSTs do not). */
export const KYC_PLAN_RETRY_DELAYS_MS = [400, 1200]

/** Where a plan read came from, for the failure event. */
export type KycPlanReadSource = 'home' | 'verify' | 'initiate' | 'status-sync' | 'entry'

/** The plan could not be read, so nothing says which flow the user is on. */
export class KycPlanUnavailableError extends Error {
    constructor(
        readonly attempts: number,
        readonly status: number | undefined
    ) {
        super('KYC plan unavailable')
    }
}

/**
 * The plan, or null when the API has none to give: a domain 404, or on a
 * production build an API in another contract (reported, never silent). A
 * test build throws instead, so a wrong API pairing can't hide.
 *
 * Neither a null result nor a failed read authorizes legacy initiation.
 */
export async function findKycDocumentPlan(
    source?: KycPlanReadSource,
    signal?: AbortSignal,
    feature?: KycPlanFeature,
    attemptId?: string
): Promise<KycDocumentPlan | null> {
    for (let attempt = 1; ; attempt++) {
        if (signal?.aborted) throw signal.reason
        try {
            return await getKycDocumentPlan(false, signal, feature, attemptId)
        } catch (error) {
            if (signal?.aborted) throw signal.reason
            const { status, code } = error as { status?: number; code?: string }
            if (code === API_CONTRACT_ERROR) {
                if (!isTestApiBuild()) return null
                throw new KycPlanUnavailableError(attempt, status)
            }
            if (status === 404) return null
            if (status === 403 && code === 'residence_not_supported') throw error
            if (attempt > KYC_PLAN_RETRY_DELAYS_MS.length) {
                posthog.capture(ANALYTICS_EVENTS.KYC_PV_PLAN_FAILED, {
                    attempts: attempt,
                    http_status: status ?? null,
                    source: source ?? null,
                })
                throw new KycPlanUnavailableError(attempt, status)
            }
            await new Promise((resolve) => setTimeout(resolve, KYC_PLAN_RETRY_DELAYS_MS[attempt - 1]))
        }
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
    | {
          kind: 'failed'
          error?: string
          code?: SumsubActionErrorCode
          cooldown?: { retryAt?: string }
          document?: { type: string; issuingCountry: string }
      }

/** Restart an attempt-based identity on new documents. The API keeps the attempt's flow (Smart Paperwork Verification stays on it). */
export async function startKycDocumentReplacement(replacement: KycReplacementChoices): Promise<KycReplacementResult> {
    const response = await restartIdentityVerification(undefined, replacement)
    if (!response.data)
        return {
            kind: 'failed',
            error: response.error,
            code: response.code,
            cooldown: response.cooldown,
            ...(response.document && { document: response.document }),
        }
    try {
        return { kind: 'session', session: validSession(response.data as KycAttemptSession) }
    } catch {
        reportApiContractError('/users/identity/restart', 'POST', 'invalid_session', 200)
        return { kind: 'failed', code: 'invalid_response' }
    }
}
export async function resumeKycDocumentAttempt(
    attemptId: string,
    beforeDispatch?: () => boolean,
    signal?: AbortSignal
) {
    let status: number | undefined
    try {
        const response = await serverFetch(`/users/kyc/attempts/${encodeURIComponent(attemptId)}/token`, {
            method: 'POST',
            ...(signal
                ? { signal, beforeDispatch: () => !signal.aborted && (beforeDispatch?.() ?? true) }
                : beforeDispatch && { beforeDispatch }),
            body: '{}',
            headers: kycClientHeaders(),
            cache: 'no-store',
            redactTelemetry: true,
        })
        status = response.status
        const body = await response.json().catch(() => null)
        if (response.ok) {
            try {
                return validSession(body, false)
            } catch (error) {
                reportApiContractError(
                    '/users/kyc/attempts/{attemptId}/token',
                    'POST',
                    'invalid_session',
                    response.status
                )
                throw error
            }
        }
        if (response.status === 404 && body?.code === 'route_not_found')
            throw contractError('/users/kyc/attempts/{attemptId}/token', 'POST', response.status, 'route_not_found')
        // A crash can leave the saved replacement before its remote reset. Only that explicit response resumes the authorised reset ledger.
        // Conflicts carry a stable `code`; older bodies name it only in `error`.
        if (response.status === 409 && [body?.code, body?.error].includes('replacement_reset_required'))
            return validSession(
                await read<KycAttemptSession>('/users/identity/restart', {
                    method: 'POST',
                    body: '{}',
                    ...(signal && { signal }),
                    ...(beforeDispatch && { beforeDispatch }),
                })
            )
        throw Object.assign(new Error('KYC request failed'), {
            code: body?.code ?? body?.error,
            status: response.status,
            userMessage: typeof body?.userMessage === 'string' ? body.userMessage : undefined,
        })
    } catch (error) {
        if (signal?.aborted) throw error
        if (
            (error as { code?: string })?.code !== API_CONTRACT_ERROR &&
            !(status !== undefined && status >= 200 && status < 500)
        )
            Sentry.captureException(error, { tags: { ...criticalFlowTags('kyc'), kyc_step: 'identity_session' } })
        throw error
    }
}
/** Read-only fallback for a missed identity websocket event; never opens or refreshes an applicant. */
const CANDIDATE_STATUS: Record<FeatureReverificationStatus, SumsubKycStatus> = {
    READY: 'NOT_STARTED',
    COLLECTING: 'NOT_STARTED',
    IN_REVIEW: 'IN_REVIEW',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
    SUPERSEDED: 'REJECTED',
}

export function candidateDocumentStatus(status: FeatureReverificationStatus): SumsubKycStatus {
    return CANDIDATE_STATUS[status]
}

export async function getKycDocumentStatus(
    signal?: AbortSignal,
    attemptId?: string
): Promise<SumsubKycStatus | undefined> {
    if (attemptId) {
        const profile = await read<KycProfile>('/users/kyc/profile', { signal })
        if (!Array.isArray(profile.attempts)) throw contractError('/users/kyc/profile', 'GET', 200, 'invalid_attempts')
        const attempt = profile.attempts.find((item) => item?.kind === 'IDENTITY' && item.id === attemptId)
        if (!attempt || !Object.hasOwn(CANDIDATE_STATUS, attempt.status)) return undefined
        if (attempt.status === 'COLLECTING' && (attempt.reviewedAt || attempt.retryRequestedAt))
            return 'ACTION_REQUIRED'
        return candidateDocumentStatus(attempt.status)
    }
    const profile = await read<Pick<KycProfile, 'identity'>>('/users/kyc/profile', { signal })
    const status = profile.identity?.canonicalStatus
    if (profile.identity !== null && (typeof status !== 'string' || !KNOWN_STATUSES.has(status)))
        throw contractError('/users/kyc/profile', 'GET', 200, 'invalid_status')
    return status && KNOWN_STATUSES.has(status) ? (status as SumsubKycStatus) : undefined
}

/**
 * Asks the API to read the applicant's status from Sumsub now, instead of
 * waiting for the webhook. Right after the SDK the stored status can still say
 * NOT_STARTED; undefined when there is nothing to refresh or the call failed.
 */
export async function refreshKycIdentityStatus(
    attemptId?: string,
    signal?: AbortSignal
): Promise<SumsubKycStatus | undefined> {
    try {
        const query = attemptId ? `?attemptId=${encodeURIComponent(attemptId)}` : ''
        const refreshed = await read<{ status: string | null }>(`/users/kyc/identity/refresh${query}`, {
            method: 'POST',
            body: JSON.stringify({}),
            ...(signal && { signal }),
        }).catch((error: { status?: number; code?: string }) => {
            if (attemptId && error.status === 404 && error.code === ATTEMPT_NOT_ACTIVE) return null
            throw error
        })
        // Read the candidate even when the refresh arrived after its claim was archived.
        if (attemptId) return await getKycDocumentStatus(signal, attemptId)
        const status = refreshed?.status
        if (status !== null && (typeof status !== 'string' || !KNOWN_STATUSES.has(status)))
            throw contractError('/users/kyc/identity/refresh', 'POST', 200, 'invalid_status')
        return status ? (status as SumsubKycStatus) : undefined
    } catch (error) {
        if (!signal?.aborted && (error as { code?: string })?.code !== API_CONTRACT_ERROR) {
            Sentry.captureMessage('KYC identity refresh failed', {
                level: 'warning',
                tags: { ...criticalFlowTags('kyc'), kyc_step: 'identity_refresh' },
                extra: { route: '/users/kyc/identity/refresh', method: 'POST' },
            })
        }
        return undefined
    }
}

/** True when the current identity was verified through a verification attempt. */
function attemptIdentity(profile: KycProfile): boolean {
    if (
        !('identity' in profile) ||
        (profile.identity !== null && (typeof profile.identity !== 'object' || Array.isArray(profile.identity)))
    )
        throw contractError('/users/kyc/profile', 'GET', 200, 'invalid_identity')
    if (
        !Array.isArray(profile.attempts) ||
        profile.attempts.some(
            (attempt) =>
                !attempt ||
                typeof attempt !== 'object' ||
                typeof attempt.kind !== 'string' ||
                typeof attempt.status !== 'string'
        )
    )
        throw contractError('/users/kyc/profile', 'GET', 200, 'invalid_attempts')
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
 * True when the current identity was verified through a Smart Paperwork
 * Verification attempt, whose status is the /verify timeline. False for every
 * other identity, and when a read fails (the identity status then shows).
 */
export async function isPaperworkVerificationIdentity(): Promise<boolean> {
    try {
        const [profile, plan] = await Promise.all([read<KycProfile>('/users/kyc/profile'), getKycDocumentPlan()])
        return attemptIdentity(profile) && plan.flow === PAPERWORK_VERIFICATION_FLOW
    } catch {
        return false
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
