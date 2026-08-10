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

const backendOrFallback = (
    responseJson: { userMessage?: string; error?: string },
    fallback: string,
    code: SumsubActionErrorCode
): SumsubActionError => {
    const backendMessage = responseJson.userMessage || responseJson.error
    return backendMessage ? { error: backendMessage } : { error: fallback, code }
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
export const restartIdentityVerification = async (): Promise<{
    data?: RestartIdentityResponse
    error?: string
    code?: SumsubActionErrorCode
}> => {
    try {
        const response = await serverFetch('/users/identity/restart', { method: 'POST' })
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
 * Exchange the `bridge-hosted` capability action for Bridge's hosted
 * verification URL (same POST /users/kyc/start-action endpoint as
 * {@link startKycAction}, different response shape: that path mints Sumsub
 * tokens, this one returns a URL — hence its own guard).
 */
export const startBridgeHostedVerification = async (): Promise<{ url?: string; error?: string }> => {
    try {
        const response = await serverFetch('/users/kyc/start-action', {
            method: 'POST',
            body: JSON.stringify({ key: 'bridge-hosted' }),
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

/**
 * Exchange the `bridge-hosted` capability action for Bridge's hosted
 * verification URL (same POST /users/kyc/start-action endpoint as
 * {@link startKycAction}, different response shape: that path mints Sumsub
 * tokens, this one returns a URL — hence its own guard).
 */
export const startBridgeHostedVerification = async (): Promise<{ url?: string; error?: string }> => {
    try {
        const response = await serverFetch('/users/kyc/start-action', {
            method: 'POST',
            body: JSON.stringify({ key: 'bridge-hosted' }),
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
