import { PEANUT_API_URL } from '@/constants'
import { fetchWithSentry } from '@/utils'
import { RewardLink } from './services.types'
import Cookies from 'js-cookie'

export const rewardsApi = {
    getByUser: async (userId: string): Promise<RewardLink[]> => {
        const response = await fetchWithSentry(`${PEANUT_API_URL}/users/${userId}/rewards`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${Cookies.get('jwt-token')}`,
            },
        })
        if (!response.ok) {
            throw new Error(`Failed to fetch rewards: ${response.statusText}`)
        }
        const data = await response.json()
        return data as RewardLink[]
    },
}
