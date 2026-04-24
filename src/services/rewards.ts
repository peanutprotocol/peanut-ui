import { getAuthToken } from '@/utils/auth-token'
import { fetchWithSentry } from '@/utils/sentry.utils'
import { type RewardLink } from './services.types'
import { PEANUT_API_URL } from '@/constants/general.consts'

export const rewardsApi = {
    getByUser: async (userId: string): Promise<RewardLink[]> => {
        const response = await fetchWithSentry(`${PEANUT_API_URL}/users/${userId}/rewards`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${getAuthToken()}`,
            },
        })
        if (!response.ok) {
            throw new Error(`Failed to fetch rewards: ${response.statusText}`)
        }
        const data = await response.json()
        return data as RewardLink[]
    },
}
