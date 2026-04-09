// card api calls — works in both web (server action) and native (client-side)
// migrated from 'use server' to support capacitor static export

import { PEANUT_API_URL } from '@/constants/general.consts'
import { fetchWithSentry } from '@/utils/sentry.utils'
import { getAuthHeaders } from '@/utils/auth-token'

export interface CardInfoResponse {
    hasPurchased: boolean
    chargeStatus?: string
    chargeUuid?: string
    paymentUrl?: string
    isEligible: boolean
    eligibilityReason?: string
    price: number
    currentTier: number
    slotsRemaining?: number
    recentPurchases?: number
}

export interface CardPurchaseResponse {
    chargeUuid: string
    paymentUrl: string
    price: number
    // Semantic URL components for direct navigation (avoids extra API call)
    recipientAddress: string
    chainId: string
    tokenAmount: string
    tokenSymbol: string
}

export interface CardErrorResponse {
    error: string
    message: string
    chargeUuid?: string
}

/**
 * Get card pioneer info for the authenticated user
 */
export const getCardInfo = async (): Promise<{ data?: CardInfoResponse; error?: string }> => {
    try {
        const response = await fetchWithSentry(`${PEANUT_API_URL}/card`, {
            method: 'GET',
            headers: getAuthHeaders(),
        })

        if (!response.ok) {
            const errorData = await response.json()
            return { error: errorData.message || 'Failed to get card info' }
        }

        const data = await response.json()
        return { data }
    } catch (e: any) {
        return { error: e.message || 'An unexpected error occurred' }
    }
}

/**
 * Initiate card pioneer purchase
 */
export const purchaseCard = async (): Promise<{ data?: CardPurchaseResponse; error?: string; errorCode?: string }> => {
    try {
        const response = await fetchWithSentry(`${PEANUT_API_URL}/card/purchase`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({}),
        })

        if (!response.ok) {
            const errorData: CardErrorResponse = await response.json()
            return {
                error: errorData.message || 'Failed to initiate purchase',
                errorCode: errorData.error,
            }
        }

        const data = await response.json()
        return { data }
    } catch (e: any) {
        return { error: e.message || 'An unexpected error occurred' }
    }
}
