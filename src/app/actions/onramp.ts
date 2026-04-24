import { fetchWithSentry } from '@/utils/sentry.utils'
import { type CountryData } from '@/components/AddMoney/consts'
import { getCurrencyConfig } from '@/utils/bridge.utils'
import { getCurrencyPrice } from '@/app/actions/currency'
import { PEANUT_API_URL } from '@/constants/general.consts'
import { getAuthHeaders } from '@/utils/auth-token'

export interface CreateOnrampGuestParams {
    amount: string
    country: CountryData
    userId: string
    chargeId?: string
}

/**
 * Cancel an on-ramp transfer.
 *
 * calls the `/bridge/onramp/:transferId/cancel` API endpoint to cancel the transfer
 * and returns the success status or error message.
 *
 * @param transferId - The ID of the transfer to cancel.
 * @returns An object containing either the successful response data or an error.
 */
export async function cancelOnramp(transferId: string): Promise<{ data?: { success: boolean }; error?: string }> {
    try {
        const response = await fetchWithSentry(`${PEANUT_API_URL}/bridge/onramp/${transferId}/cancel`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        })

        if (!response.ok) {
            const data = await response.json()
            return { error: data.error || 'Failed to cancel on-ramp transfer.' }
        }

        return { data: { success: true } }
    } catch (error) {
        console.error('Error calling cancel on-ramp API:', error)
        if (error instanceof Error) {
            return { error: error.message }
        }
        return { error: 'An unexpected error occurred.' }
    }
}

export async function createOnrampForGuest(
    params: CreateOnrampGuestParams
): Promise<{ data?: { success: boolean }; error?: string }> {
    try {
        const { currency, paymentRail } = getCurrencyConfig(params.country.id, 'onramp')
        const price = await getCurrencyPrice(currency)
        const amount = (Number(params.amount) * price.buy).toFixed(2)

        const response = await fetchWithSentry(`${PEANUT_API_URL}/bridge/onramp/create-for-guest`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify({
                amount,
                userId: params.userId,
                chargeId: params.chargeId,
                source: {
                    currency,
                    paymentRail,
                },
            }),
        })

        const data = await response.json()

        if (!response.ok) {
            console.log('error', response)
            return { error: data.error || 'Failed to create on-ramp transfer for guest.' }
        }

        return { data }
    } catch (error) {
        console.error('Error calling create on-ramp for guest API:', error)
        if (error instanceof Error) {
            return { error: error.message }
        }
        return { error: 'An unexpected error occurred.' }
    }
}
