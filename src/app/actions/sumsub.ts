import { type InitiateSumsubKycResponse, type KYCRegionIntent } from './types/sumsub.types'
import { serverFetch } from '@/utils/api-fetch'

/**
 * Stable discriminant for the English fallback errors below. Server actions
 * can't run next-intl, so alongside the prose they return a `code` the client
 * translates (see useSumsubKycFlow). `code` is only set when we fell back to
 * our canned copy — a backend `userMessage` is specific, display-ready prose
 * and stays untranslated (#2554: keep BE prose as fallback where no code exists).
 */
export type SumsubActionErrorCode =
    // Permanent refusals the backend names in its `error` field. A retry sends
    // the identical request and gets the identical answer, so callers must
    // suppress their retry CTA on these.
    | 'target_country_required'
    | 'unsupported_target_country'
    | 'manteca_us_nationality_restricted'
    | 'initiate_failed'
    | 'restart_failed'
    | 'resubmit_failed'
    | 'start_action_failed'
    | 'invalid_response'
    | 'unexpected'

interface SumsubActionError {
    error: string
    code?: SumsubActionErrorCode
}

/** Permanent refusals. These have no catalog entry, so classifying one never
 *  displaces the backend's own explanation. */
const TERMINAL_ACTION_CODES = new Set<string>([
    'target_country_required',
    'unsupported_target_country',
    'manteca_us_nationality_restricted',
])

/** True when the result is a refusal no retry can change. */
export const isTerminalActionCode = (code?: SumsubActionErrorCode): boolean => !!code && TERMINAL_ACTION_CODES.has(code)

/**
 * The backend's `error` field carries a MACHINE CODE on these routes, while
 * `userMessage` carries the prose — but older routes put prose in `error`. So
 * `error` is only read as a code when it matches one we know, and a recognized
 * code is never shown to the user: rendering it verbatim is the raw-code
 * outcome this whole path exists to remove.
 */
const terminalCodeOf = (responseJson: { error?: string }): SumsubActionErrorCode | undefined =>
    typeof responseJson.error === 'string' && TERMINAL_ACTION_CODES.has(responseJson.error)
        ? (responseJson.error as SumsubActionErrorCode)
        : undefined

const backendOrFallback = (
    responseJson: { userMessage?: string; error?: string },
    fallback: string,
    code: SumsubActionErrorCode
): SumsubActionError => {
    const terminal = terminalCodeOf(responseJson)
    const backendMessage = responseJson.userMessage || (terminal ? undefined : responseJson.error)
    // A permanent refusal keeps its code so the caller can suppress the retry,
    // AND its message — the two are not in competition.
    if (terminal) return { error: backendMessage || fallback, code: terminal }
    // Everything else: a backend message stays codeless, because
    // `actionErrorMessage` prefers a mapped code over the message and would
    // replace a specific explanation with generic retry copy.
    if (!backendMessage) return { error: fallback, code }
    return { error: backendMessage }
}

const caughtError = (e: unknown): SumsubActionError =>
    e instanceof Error ? { error: e.message } : { error: 'An unexpected error occurred', code: 'unexpected' }

// initiate kyc flow (using sumsub) and get websdk access token
export const initiateSumsubKyc = async (params?: {
    regionIntent?: KYCRegionIntent
    levelName?: string
    crossRegion?: boolean
    targetCountry?: string
}): Promise<{ data?: InitiateSumsubKycResponse; error?: string; code?: SumsubActionErrorCode }> => {
    const body: Record<string, string | boolean | undefined> = {
        regionIntent: params?.regionIntent,
        levelName: params?.levelName,
        crossRegion: params?.crossRegion,
        targetCountry: params?.targetCountry,
    }

    try {
        const response = await serverFetch('/users/identity', {
            method: 'POST',
            body: JSON.stringify(body),
        })

        const responseJson = await response.json()

        if (!response.ok) {
            return backendOrFallback(responseJson, 'Failed to initiate identity verification', 'initiate_failed')
        }

        return {
            data: {
                token: responseJson.token,
                applicantId: responseJson.applicantId,
                status: responseJson.status,
                actionType: responseJson.actionType,
            },
        }
    } catch (e: unknown) {
        return caughtError(e)
    }
}

export interface SelfHealResubmissionResponse {
    token: string
    applicantId: string
    actionId: string
    externalActionId: string
    requiredAction: 'REUPLOAD_ID' | 'REUPLOAD_ADDRESS_PROOF' | 'CONTACT_SUPPORT' | 'RAIN_DOCUMENT'
    userMessage: string
    attempt: number
    maxAttempts: number
}

export interface RestartIdentityResponse {
    token: string
    levelName: string
    applicantId: string
}

/**
 * Reset the user's Sumsub IDENTITY step and mint a fresh token. Used as the
 * "Verify with a different document" CTA on a Manteca rail that's blocked
 * because the user verified with a non-AR/BR document.
 */
// The intents the restart route accepts; a server action is a public endpoint,
// so anything else is dropped here rather than forwarded.
const RESTART_REGION_INTENTS: ReadonlySet<string> = new Set(['LATAM', 'ROW', 'EU', 'NA'])

export const restartIdentityVerification = async (
    regionIntent?: KYCRegionIntent
): Promise<{
    data?: RestartIdentityResponse
    error?: string
    code?: SumsubActionErrorCode
}> => {
    try {
        const intent = regionIntent && RESTART_REGION_INTENTS.has(regionIntent) ? regionIntent : undefined
        const response = await serverFetch('/users/identity/restart', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(intent ? { regionIntent: intent } : {}),
        })
        const responseJson = await response.json()
        if (!response.ok) {
            return backendOrFallback(responseJson, 'Failed to restart identity verification', 'restart_failed')
        }
        return { data: responseJson }
    } catch (e: unknown) {
        return caughtError(e)
    }
}

// initiate self-heal document resubmission for a provider-rejected user
export const initiateSelfHealResubmission = async (
    provider: 'BRIDGE' | 'MANTECA' | 'RAIN',
    // Optional — target a specific (e.g. future-dated advisory) Bridge requirement
    // by key. Omitted for the legacy blocking flow (current nextAction).
    requirementKey?: string
): Promise<{ data?: SelfHealResubmissionResponse; error?: string; code?: SumsubActionErrorCode }> => {
    try {
        const response = await serverFetch('/users/identity/resubmit', {
            method: 'POST',
            body: JSON.stringify({ provider, ...(requirementKey ? { requirementKey } : {}) }),
        })

        const responseJson = await response.json()

        if (!response.ok) {
            return backendOrFallback(responseJson, 'Failed to initiate document resubmission', 'resubmit_failed')
        }

        if (!responseJson.token || !responseJson.applicantId) {
            return { error: 'Invalid response from server', code: 'invalid_response' }
        }

        return { data: responseJson }
    } catch (e: unknown) {
        return caughtError(e)
    }
}

/**
 * Exchange a hosted-verification capability action for its provider's hosted
 * URL (same POST /users/kyc/start-action endpoint as {@link startKycAction},
 * different response shape: that path mints Sumsub tokens, this one returns a
 * URL — hence its own guard). Serves both `bridge-hosted` (Bridge/Persona) and
 * `rain-hosted` (Rain's card-member portal); the key selects the provider.
 */
export const startHostedVerification = async (
    key: 'bridge-hosted' | 'rain-hosted' = 'bridge-hosted'
): Promise<{ url?: string; error?: string }> => {
    try {
        const response = await serverFetch('/users/kyc/start-action', {
            method: 'POST',
            body: JSON.stringify({ key }),
        })
        const responseJson = await response.json()
        if (!response.ok) {
            return { error: responseJson.userMessage || responseJson.error || 'Failed to start verification' }
        }
        if (!responseJson.verificationUrl) {
            return { error: 'Invalid response from server' }
        }
        return { url: responseJson.verificationUrl }
    } catch (e: unknown) {
        return { error: e instanceof Error ? e.message : 'An unexpected error occurred' }
    }
}

export interface StartKycActionResponse {
    token: string
    levelName: string
    externalActionId?: string
}

/**
 * Mint a Sumsub WebSDK token for a capability nextAction by its `key`
 * (POST /users/kyc/start-action). The capability model returns action
 * descriptors (a stable key + a registry levelKey) and never carries a token;
 * the FE posts the key here to get an unexpired token bound to the right RFI
 * level. Used by the advisory pre-empt — an already-approved user starting a
 * future-dated RFI early, where /users/identity would short-circuit on
 * "already approved" and never mint a token.
 */
export const startKycAction = async (
    key: string
): Promise<{ data?: StartKycActionResponse; error?: string; code?: SumsubActionErrorCode }> => {
    try {
        const response = await serverFetch('/users/kyc/start-action', {
            method: 'POST',
            body: JSON.stringify({ key }),
        })
        const responseJson = await response.json()
        if (!response.ok) {
            return backendOrFallback(responseJson, 'Failed to start verification', 'start_action_failed')
        }
        if (!responseJson.sumsubAccessToken) {
            return { error: 'Invalid response from server', code: 'invalid_response' }
        }
        return {
            data: {
                token: responseJson.sumsubAccessToken,
                levelName: responseJson.levelName,
                externalActionId: responseJson.externalActionId,
            },
        }
    } catch (e: unknown) {
        return caughtError(e)
    }
}
