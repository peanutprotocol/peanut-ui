/**
 * Quests API Service
 * Handles all quest-related API calls
 */

import Cookies from 'js-cookie'
import { fetchWithSentry } from '@/utils'
import { PEANUT_API_URL, PEANUT_API_KEY } from '@/constants'
import type { QuestLeaderboardData, AllQuestsLeaderboardData } from '@/app/quests/types'

export const questsApi = {
    /**
     * Get leaderboards for all quests (top 3 each for landing page)
     * If authenticated, also returns user's status for each quest
     */
    async getAllLeaderboards(params?: { limit?: number; useTestTimePeriod?: boolean }): Promise<{
        success: boolean
        data?: AllQuestsLeaderboardData
        error?: string
    }> {
        try {
            const jwtToken = Cookies.get('jwt-token')
            const limit = params?.limit || 3
            const useTestTimePeriod = params?.useTestTimePeriod ? 'true' : 'false'
            const url = `${PEANUT_API_URL}/quests/leaderboards?limit=${limit}&useTestTimePeriod=${useTestTimePeriod}`

            const headers: HeadersInit = {
                'Content-Type': 'application/json',
                'api-key': PEANUT_API_KEY,
            }

            if (jwtToken) {
                headers['Authorization'] = `Bearer ${jwtToken}`
            }

            const response = await fetchWithSentry(url, {
                method: 'GET',
                headers,
            })

            if (!response.ok) {
                throw new Error(`Failed to fetch leaderboards: ${response.statusText}`)
            }

            const data = await response.json()
            return { success: true, data }
        } catch (error: any) {
            console.error('Error fetching all quest leaderboards:', error)
            return {
                success: false,
                error: error?.message || 'Failed to fetch leaderboards',
            }
        }
    },

    /**
     * Get leaderboard for a specific quest (top 10 for detail page)
     * If authenticated, also returns user's status (metric only, not position)
     */
    async getQuestLeaderboard(
        questId: 'most_invites' | 'bank_drainer' | 'biggest_pot',
        params?: { limit?: number; useTestTimePeriod?: boolean }
    ): Promise<{
        success: boolean
        data?: QuestLeaderboardData
        error?: string
    }> {
        try {
            const jwtToken = Cookies.get('jwt-token')
            const limit = params?.limit || 10
            const useTestTimePeriod = params?.useTestTimePeriod ? 'true' : 'false'
            const url = `${PEANUT_API_URL}/quests/${questId}/leaderboard?limit=${limit}&useTestTimePeriod=${useTestTimePeriod}`

            const headers: HeadersInit = {
                'Content-Type': 'application/json',
                'api-key': PEANUT_API_KEY,
            }

            if (jwtToken) {
                headers['Authorization'] = `Bearer ${jwtToken}`
            }

            const response = await fetchWithSentry(url, {
                method: 'GET',
                headers,
            })

            if (!response.ok) {
                throw new Error(`Failed to fetch ${questId} leaderboard: ${response.statusText}`)
            }

            const data = await response.json()
            return { success: true, data }
        } catch (error: any) {
            console.error(`Error fetching ${questId} leaderboard:`, error)
            return {
                success: false,
                error: error?.message || 'Failed to fetch leaderboard',
            }
        }
    },
}
