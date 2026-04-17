import { type InitiateSumsubKycResponse, type KYCRegionIntent } from './types/sumsub.types'
import { fetchWithSentry } from '@/utils/sentry.utils'
import { PEANUT_API_URL } from '@/constants/general.consts'
import { getAuthHeaders } from '@/utils/auth-token'

// initiate kyc flow (using sumsub) and get websdk access token
export const initiateSumsubKyc = async (params?: {
    regionIntent?: KYCRegionIntent
    levelName?: string
}): Promise<{ data?: InitiateSumsubKycResponse; error?: string }> => {
    const body: Record<string, string | undefined> = {
        regionIntent: params?.regionIntent,
        levelName: params?.levelName,
    }

    try {
        const response = await fetchWithSentry(`${PEANUT_API_URL}/users/identity`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
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
            },
        }
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'An unexpected error occurred'
        return { error: message }
    }
}
