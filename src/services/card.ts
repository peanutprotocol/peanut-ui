/**
 * Card Pioneers API Service
 *
 * Client-side fetches to the Pioneer info/purchase endpoints. Matches the
 * pattern in `services/rain.ts` and `services/manteca.ts` — JWT from a
 * cookie, no Next.js server action indirection.
 */

import Cookies from 'js-cookie'
import { PEANUT_API_KEY, PEANUT_API_URL } from '@/constants/general.consts'
import { fetchWithSentry } from '@/utils/sentry.utils'

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

function authHeaders(): Record<string, string> {
    const jwt = Cookies.get('jwt-token')
    if (!jwt) throw new Error('Authentication required')
    return {
        Authorization: `Bearer ${jwt}`,
        'api-key': PEANUT_API_KEY,
    }
}

export const cardApi = {
    /**
     * Get card pioneer info for the authenticated user.
     * Returns eligibility, purchase status, and pricing.
     */
    getInfo: async (): Promise<CardInfoResponse> => {
        const response = await fetchWithSentry(`${PEANUT_API_URL}/card`, {
            method: 'GET',
            headers: authHeaders(),
            cache: 'no-store',
        })
        if (!response.ok) {
            const err = await response.json().catch(() => ({}))
            throw new Error(err.message || err.error || 'Failed to get card info')
        }
        return (await response.json()) as CardInfoResponse
    },

    /**
     * Initiate a card pioneer purchase. Creates a charge the user must pay.
     */
    purchase: async (): Promise<CardPurchaseResponse> => {
        const response = await fetchWithSentry(`${PEANUT_API_URL}/card/purchase`, {
            method: 'POST',
            headers: { ...authHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
            cache: 'no-store',
        })
        if (!response.ok) {
            const err = await response.json().catch(() => ({}))
            throw new CardPurchaseError(err.error || 'UNKNOWN_ERROR', err.message || 'Failed to initiate purchase')
        }
        return (await response.json()) as CardPurchaseResponse
    },
}
