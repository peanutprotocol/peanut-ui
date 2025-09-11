import { PEANUT_API_URL } from '@/constants'
import { fetchWithSentry } from '@/utils'
import Cookies from 'js-cookie'

export const mantecaApi = {
    initiateOnboarding: async (params: {
        returnUrl: string
        failureUrl?: string
        exchange?: string
    }): Promise<{ url: string }> => {
        const response = await fetchWithSentry(`${PEANUT_API_URL}/manteca/initiate-onboarding`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${Cookies.get('jwt-token')}`,
            },
            body: JSON.stringify(params),
        })

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            throw new Error(errorData.message || `Failed to get onboarding URL`)
        }

        return response.json()
    },
}
