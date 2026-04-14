'use server'

import { fetchWithSentry } from '@/utils/sentry.utils'
import { PEANUT_API_URL } from '@/constants/general.consts'
import { getJWTCookie } from '@/utils/cookie-migration.utils'

const API_KEY = process.env.PEANUT_API_KEY!

export interface IncreaseLimitsResponse {
    token: string | null
    applicantId?: string | null
    status: string
    message?: string
}

export const initiateIncreaseLimits = async (): Promise<{ data?: IncreaseLimitsResponse; error?: string }> => {
    const jwtToken = (await getJWTCookie())?.value

    if (!jwtToken) {
        return { error: 'Authentication required' }
    }

    try {
        const response = await fetchWithSentry(`${PEANUT_API_URL}/users/increase-limits`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${jwtToken}`,
                'api-key': API_KEY,
            },
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
