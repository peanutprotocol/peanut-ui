'use server'

import { PEANUT_API_URL } from '@/constants/general.consts'
import { fetchWithSentry } from '@/utils/sentry.utils'
import { getJWTCookie } from '@/utils/cookie-migration.utils'

const API_KEY = process.env.PEANUT_API_KEY!

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
}

export interface CardPurchaseResponse {
	chargeUuid: string
	paymentUrl: string
	price: number
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
	const jwtToken = (await getJWTCookie())?.value

	try {
		const response = await fetchWithSentry(`${PEANUT_API_URL}/card`, {
			method: 'GET',
			headers: {
				Authorization: `Bearer ${jwtToken}`,
				'api-key': API_KEY,
			},
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
	const jwtToken = (await getJWTCookie())?.value

	try {
		const response = await fetchWithSentry(`${PEANUT_API_URL}/card/purchase`, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${jwtToken}`,
				'api-key': API_KEY,
				'Content-Type': 'application/json',
			},
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
