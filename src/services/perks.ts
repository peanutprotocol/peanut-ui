import { serverFetch } from '@/utils/api-fetch'

export type PendingPerk = {
    id: string
    name?: string
    description?: string
    reason?: string
    amountUsd: number
    createdAt: string
    /** Extracted invitee name from BE (avoids FE regex parsing of reason) */
    inviteeName?: string
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
            const response = await serverFetch('/perks/pending', {
                method: 'GET',
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
            const response = await serverFetch('/perks/claim', {
                method: 'POST',
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
