// card api calls — works in both web (via proxy) and native (direct backend)

import { serverFetch } from '@/utils/api-fetch'

export interface CardInfoResponse {
    hasPurchased: boolean
    /** True if the user can enter the Rain card flow — either via Pioneer
     *  purchase or a manual admin grant. Gate downstream states on this. */
    hasCardAccess: boolean
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
        const response = await serverFetch('/card', {
            method: 'GET',
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
        const response = await serverFetch('/card/purchase', {
            method: 'POST',
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
