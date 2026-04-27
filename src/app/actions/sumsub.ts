'use server'

import { type InitiateSumsubKycResponse, type KYCRegionIntent } from './types/sumsub.types'
import { fetchWithSentry } from '@/utils/sentry.utils'
import { PEANUT_API_URL } from '@/constants/general.consts'
import { getJWTCookie } from '@/utils/cookie-migration.utils'

const API_KEY = process.env.PEANUT_API_KEY!

// initiate kyc flow (using sumsub) and get websdk access token
export const initiateSumsubKyc = async (params?: {
    regionIntent?: KYCRegionIntent
    levelName?: string
    crossRegion?: boolean
}): Promise<{ data?: InitiateSumsubKycResponse; error?: string }> => {
    const jwtToken = (await getJWTCookie())?.value

    if (!jwtToken) {
        return { error: 'Authentication required' }
    }

    const body: Record<string, string | boolean | undefined> = {
        regionIntent: params?.regionIntent,
        levelName: params?.levelName,
        crossRegion: params?.crossRegion,
    }

    try {
        const response = await fetchWithSentry(`${PEANUT_API_URL}/users/identity`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${jwtToken}`,
                'api-key': API_KEY,
            },
            body: JSON.stringify(body),
        })

        const responseJson = await response.json()

        if (!response.ok) {
            return { error: responseJson.message || responseJson.error || 'Failed to initiate identity verification' }
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

// initiate self-heal document resubmission for a provider-rejected user
export const initiateSelfHealResubmission = async (
    provider: 'BRIDGE' | 'MANTECA'
): Promise<{ data?: SelfHealResubmissionResponse; error?: string }> => {
    const jwtToken = (await getJWTCookie())?.value

    if (!jwtToken) {
        return { error: 'Authentication required' }
    }

    try {
        const response = await fetchWithSentry(`${PEANUT_API_URL}/users/identity/resubmit`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${jwtToken}`,
                'api-key': API_KEY,
            },
            body: JSON.stringify({ provider }),
        })

        const responseJson = await response.json()

        if (!response.ok) {
            return {
                error: responseJson.userMessage || responseJson.error || 'Failed to initiate document resubmission',
            }
        }

        return { data: responseJson }
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'An unexpected error occurred'
        return { error: message }
    }
}
