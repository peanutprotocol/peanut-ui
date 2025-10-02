import Cookies from 'js-cookie'
import { CalculatePointsRequest, PointsAction, TierInfo } from './services.types'
import { fetchWithSentry } from '@/utils'
import { PEANUT_API_URL } from '@/constants'

export const pointsApi = {
    getTierInfo: async (): Promise<{ success: boolean; data: TierInfo | null }> => {
        try {
            const jwtToken = Cookies.get('jwt-token')
            const response = await fetchWithSentry(`${PEANUT_API_URL}/points`, {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${jwtToken}`,
                    'Content-Type': 'application/json',
                },
            })
            if (!response.ok) {
                return { success: false, data: null }
            }

            const pointsInfo: TierInfo = await response.json()
            return { success: true, data: pointsInfo }
        } catch {
            return { success: false, data: null }
        }
    },

    calculatePoints: async ({
        actionType,
        usdAmount,
        otherUserId,
    }: CalculatePointsRequest): Promise<{ estimatedPoints: number }> => {
        try {
            const jwtToken = Cookies.get('jwt-token')
            const body: { actionType: PointsAction; usdAmount: number; otherUserId?: string } = {
                actionType,
                usdAmount,
            }

            if (otherUserId) {
                body.otherUserId = otherUserId
            }

            const response = await fetchWithSentry(`${PEANUT_API_URL}/points/calculate`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${jwtToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            })

            if (!response.ok) {
                throw new Error('Failed to calculate points')
            }

            const data = await response.json()

            return { estimatedPoints: data.estimatedPoints }
        } catch {
            throw new Error('Failed to calculate points')
        }
    },
}
