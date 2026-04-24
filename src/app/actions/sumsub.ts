import { type InitiateSumsubKycResponse, type KYCRegionIntent } from './types/sumsub.types'
import { serverFetch } from '@/utils/api-fetch'

// initiate kyc flow (using sumsub) and get websdk access token
export const initiateSumsubKyc = async (params?: {
    regionIntent?: KYCRegionIntent
    levelName?: string
    crossRegion?: boolean
}): Promise<{ data?: InitiateSumsubKycResponse; error?: string }> => {
    const body: Record<string, string | boolean | undefined> = {
        regionIntent: params?.regionIntent,
        levelName: params?.levelName,
        crossRegion: params?.crossRegion,
    }

    try {
        const response = await serverFetch('/users/identity', {
            method: 'POST',
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
