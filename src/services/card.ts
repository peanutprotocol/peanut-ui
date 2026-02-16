/**
 * Card Pioneers API Service
 *
 * Handles API calls for the Card Pioneers early-access program.
 * Uses server actions to securely include API keys.
 */

import { getCardInfo, purchaseCard } from '@/app/actions/card'
import type { CardInfoResponse, CardPurchaseResponse } from '@/app/actions/card'

export type { CardInfoResponse, CardPurchaseResponse }

/**
 * Custom error class for card purchase failures
 */
export class CardPurchaseError extends Error {
    code: string
    chargeUuid?: string

    constructor(code: string, message: string, chargeUuid?: string) {
        super(message)
        this.name = 'CardPurchaseError'
        this.code = code
        this.chargeUuid = chargeUuid
    }
}

export const cardApi = {
    /**
     * Get card pioneer info for the authenticated user
     * Returns eligibility, purchase status, and pricing
     */
    getInfo: async (): Promise<CardInfoResponse> => {
        const result = await getCardInfo()

        if (result.error || !result.data) {
            throw new Error(result.error || 'Failed to get card info')
        }

        return result.data
    },

    /**
     * Initiate card pioneer purchase
     * Creates a charge that the user must pay
     */
    purchase: async (): Promise<CardPurchaseResponse> => {
        const result = await purchaseCard()

        if (result.error || !result.data) {
            // Handle specific error cases
            if (result.errorCode === 'ALREADY_PURCHASED') {
                throw new CardPurchaseError(result.errorCode, result.error || 'Already purchased')
            }

            if (result.errorCode === 'NOT_ELIGIBLE') {
                throw new CardPurchaseError(result.errorCode, result.error || 'Not eligible')
            }

            throw new CardPurchaseError(
                result.errorCode || 'UNKNOWN_ERROR',
                result.error || 'Failed to initiate purchase'
            )
        }

        return result.data
    },
}
