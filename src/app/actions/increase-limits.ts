import { serverFetch } from '@/utils/api-fetch'
import type { FeatureReverificationConflict } from '@/app/actions/types/kyc-reverification.types'
import { kycClientHeaders } from '@/utils/kyc-client-headers'
import { featureReverificationConflict } from '@/utils/kyc-reverification'

export interface IncreaseLimitsResponse {
    token: string | null
    applicantId?: string | null
    status: string
    message?: string
}

export const initiateIncreaseLimits = async (): Promise<{
    data?: IncreaseLimitsResponse
    error?: string
    reverification?: FeatureReverificationConflict
}> => {
    try {
        const response = await serverFetch('/users/increase-limits', {
            method: 'POST',
            headers: kycClientHeaders(),
            body: JSON.stringify({}),
        })

        const responseJson = await response.json()

        if (!response.ok) {
            const reverification = featureReverificationConflict(response.status, responseJson)
            if (reverification) return { reverification }
            return { error: responseJson.message || responseJson.error || 'Failed to initiate limit increase' }
        }

        return { data: responseJson }
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'An unexpected error occurred'
        return { error: message }
    }
}
