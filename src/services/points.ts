import Cookies from 'js-cookie'
import { type CalculatePointsRequest, PointsAction, type TierInfo } from './services.types'
import { fetchWithSentry } from '@/utils'
import { PEANUT_API_URL } from '@/constants'

export const pointsApi = {
    getTierInfo: async (): Promise<{ success: boolean; data: TierInfo | null }> => {
        try {
            const jwtToken = Cookies.get('jwt-token')
            if (!jwtToken) {
                console.error('getTierInfo: No JWT token found')
                return { success: false, data: null }
            }

            const response = await fetchWithSentry(`${PEANUT_API_URL}/points`, {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${jwtToken}`,
                    'Content-Type': 'application/json',
                },
            })
            if (!response.ok) {
                console.error('getTierInfo: API request failed', response.status, response.statusText)
                return { success: false, data: null }
            }

            const pointsInfo: TierInfo = await response.json()
            return { success: true, data: pointsInfo }
        } catch (error) {
            console.error('getTierInfo: Unexpected error', error)
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

            if (!jwtToken) {
                const error = new Error('No JWT token found')
                console.error('calculatePoints: No JWT token found')
                throw error
            }

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
                console.error(
                    'calculatePoints: API request failed',
                    response.status,
                    response.statusText,
                    'for action',
                    actionType
                )
                throw new Error(`Failed to calculate points: ${response.status}`)
            }

            const data = await response.json()

            return { estimatedPoints: data.estimatedPoints }
        } catch (error) {
            console.error('calculatePoints: Unexpected error', error)
            throw error instanceof Error ? error : new Error('Failed to calculate points')
        }
    },
}
