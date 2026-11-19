import { serverFetch } from '@/utils/api-fetch'
import { kycClientHeaders } from '@/utils/kyc-client-headers'

export interface IncreaseLimitsResponse {
    token: string | null
    applicantId?: string | null
    status: string
    message?: string
}

export const initiateIncreaseLimits = async (): Promise<{
    data?: IncreaseLimitsResponse
    error?: string
    code?: string
}> => {
    try {
        const response = await serverFetch('/users/increase-limits', {
            method: 'POST',
            headers: kycClientHeaders(),
            body: JSON.stringify({}),
        })

        const responseJson = await response.json()

        if (!response.ok) {
            return {
                code: responseJson.code,
                error:
                    responseJson.userMessage ||
                    responseJson.message ||
                    responseJson.error ||
                    'Failed to initiate limit increase',
            }
        }

        return { data: responseJson }
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'An unexpected error occurred'
        return { error: message }
    }
}
