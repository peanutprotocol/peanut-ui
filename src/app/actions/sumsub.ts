import { type InitiateSumsubKycResponse, type KYCRegionIntent } from './types/sumsub.types'
import { serverFetch } from '@/utils/api-fetch'

// initiate kyc flow (using sumsub) and get websdk access token
export const initiateSumsubKyc = async (params?: {
    regionIntent?: KYCRegionIntent
    levelName?: string
    crossRegion?: boolean
    targetCountry?: string
}): Promise<{ data?: InitiateSumsubKycResponse; error?: string }> => {
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
            return {
                error: responseJson.userMessage || responseJson.error || 'Failed to initiate identity verification',
            }
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
        const message = e instanceof Error ? e.message : 'An unexpected error occurred'
        return { error: message }
    }
}

export interface SelfHealResubmissionResponse {
    token: string
    applicantId: string
    actionId: string
    externalActionId: string
    requiredAction: 'REUPLOAD_ID' | 'REUPLOAD_ADDRESS_PROOF' | 'CONTACT_SUPPORT'
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
}> => {
    try {
        const response = await serverFetch('/users/identity/restart', { method: 'POST' })
        const responseJson = await response.json()
        if (!response.ok) {
            return {
                error: responseJson.userMessage || responseJson.error || 'Failed to restart identity verification',
            }
        }
        return { data: responseJson }
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'An unexpected error occurred'
        return { error: message }
    }
}

// initiate self-heal document resubmission for a provider-rejected user
export const initiateSelfHealResubmission = async (
    provider: 'BRIDGE' | 'MANTECA'
): Promise<{ data?: SelfHealResubmissionResponse; error?: string }> => {
    try {
        const response = await serverFetch('/users/identity/resubmit', {
            method: 'POST',
            body: JSON.stringify({ provider }),
        })

        const responseJson = await response.json()

        if (!response.ok) {
            return {
                error: responseJson.userMessage || responseJson.error || 'Failed to initiate document resubmission',
            }
        }

        if (!responseJson.token || !responseJson.applicantId) {
            return { error: 'Invalid response from server' }
        }

        return { data: responseJson }
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'An unexpected error occurred'
        return { error: message }
    }
}
