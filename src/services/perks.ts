import Cookies from 'js-cookie'
import { fetchWithSentry } from '@/utils/sentry.utils'
import { PEANUT_API_URL } from '@/constants/general.consts'

export type PendingPerk = {
    id: string
    name?: string
    description?: string
    reason?: string
    amountUsd: number
    createdAt: string
}

export type PendingPerksResponse = {
    success: boolean
    perks: PendingPerk[]
    error?: string
}

export type ClaimPerkResponse = {
    success: boolean
    perk?: {
        sponsored: boolean
        amountSponsored: number
        discountPercentage: number
        txHash?: string
    }
    error?: string
    message?: string
}

export const perksApi = {
    /**
     * Get pending (claimable) perks for the current user
     */
    getPendingPerks: async (): Promise<PendingPerksResponse> => {
        try {
            const jwtToken = Cookies.get('jwt-token')
            if (!jwtToken) {
                console.error('getPendingPerks: No JWT token found')
                return { success: false, perks: [], error: 'Not authenticated' }
            }

            const response = await fetchWithSentry(`${PEANUT_API_URL}/perks/pending`, {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${jwtToken}`,
                    'Content-Type': 'application/json',
                },
            })

            if (!response.ok) {
                console.error('getPendingPerks: API request failed', response.status, response.statusText)
                return { success: false, perks: [], error: 'Failed to fetch pending perks' }
            }

            const data = await response.json()
            return { success: true, perks: data.perks || [] }
        } catch (error) {
            console.error('getPendingPerks: Unexpected error', error)
            return { success: false, perks: [], error: 'Unexpected error' }
        }
    },

    /**
     * Claim a perk by usage ID (V2)
     */
    claimPerk: async (usageId: string): Promise<ClaimPerkResponse> => {
        try {
            const jwtToken = Cookies.get('jwt-token')
            if (!jwtToken) {
                console.error('claimPerk: No JWT token found')
                return { success: false, error: 'NOT_AUTHENTICATED', message: 'Not authenticated' }
            }

            const response = await fetchWithSentry(`${PEANUT_API_URL}/perks/claim`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${jwtToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ usageId }),
            })

            const data = await response.json()

            if (!response.ok) {
                console.error('claimPerk: API request failed', response.status, data)
                return {
                    success: false,
                    error: data.error || 'CLAIM_FAILED',
                    message: data.message || 'Failed to claim perk',
                }
            }

            return {
                success: true,
                perk: data.perk,
            }
        } catch (error) {
            console.error('claimPerk: Unexpected error', error)
            return { success: false, error: 'UNEXPECTED_ERROR', message: 'Unexpected error' }
        }
    },
}
