import { fetchWithSentry } from '@/utils/sentry.utils'
import { PEANUT_API_URL } from '@/constants/general.consts'
import { getAuthHeaders } from '@/utils/auth-token'

export interface IncreaseLimitsResponse {
    token: string | null
    applicantId?: string | null
    status: string
    message?: string
}

export const initiateIncreaseLimits = async (): Promise<{ data?: IncreaseLimitsResponse; error?: string }> => {
    try {
        const response = await fetchWithSentry(`${PEANUT_API_URL}/users/increase-limits`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
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
