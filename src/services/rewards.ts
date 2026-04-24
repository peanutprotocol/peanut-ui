import { serverFetch } from '@/utils/api-fetch'
import { type RewardLink } from './services.types'

export const rewardsApi = {
    getByUser: async (userId: string): Promise<RewardLink[]> => {
        const response = await serverFetch(`/users/${userId}/rewards`, {
            method: 'GET',
        })
        if (!response.ok) {
            throw new Error(`Failed to fetch rewards: ${response.statusText}`)
        }
        const data = await response.json()
        return data as RewardLink[]
    },
}
