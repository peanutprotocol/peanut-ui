import { serverFetch } from '@/utils/api-fetch'

export interface IncreaseLimitsResponse {
    token: string | null
    applicantId?: string | null
    status: string
    message?: string
}

export const initiateIncreaseLimits = async (): Promise<{ data?: IncreaseLimitsResponse; error?: string }> => {
    try {
        const response = await serverFetch('/users/increase-limits', {
            method: 'POST',
            body: JSON.stringify({}),
        })

        const responseJson = await response.json()

        if (!response.ok) {
            return { error: responseJson.message || responseJson.error || 'Failed to initiate limit increase' }
        }

        return { data: responseJson }
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'An unexpected error occurred'
        return { error: message }
    }
}
