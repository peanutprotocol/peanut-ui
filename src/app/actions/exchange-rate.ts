
import { fetchWithSentry } from '@/utils/sentry.utils'
import { AccountType } from '@/interfaces'
import { PEANUT_API_URL } from '@/constants/general.consts'
import { getAuthHeaders } from '@/utils/auth-token'

export interface ExchangeRateResponse {
    from: string
    to: string
    midmarket_rate: string
    buy_rate: string
    sell_rate: string
    updated_at: string
}

/**
 * Fetch the current exchange rate for a given bank account type.
 *
 * This calls the `/bridge/exchange-rate` API endpoint.
 *
 * @param accountType - The type of bank account ('iban', 'us', 'clabe').
 * @returns An object containing either the successful response data or an error.
 */
export async function getExchangeRate(
    accountType: AccountType
): Promise<{ data?: ExchangeRateResponse; error?: string }> {
    try {
        const url = new URL(`${PEANUT_API_URL}/bridge/exchange-rate`)
        url.searchParams.append('accountType', accountType)

        const response = await fetchWithSentry(url.toString(), {
            method: 'GET',
            headers: getAuthHeaders(),
        })

        const data = await response.json()

        if (!response.ok) {
            return { error: data.error || 'Failed to fetch exchange rate.' }
        }

        return { data }
    } catch (error) {
        console.error('Error calling get exchange rate API:', error)
        if (error instanceof Error) {
            return { error: error.message }
        }
        return { error: 'An unexpected error occurred.' }
    }
}
