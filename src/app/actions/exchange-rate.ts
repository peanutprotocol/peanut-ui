'use server'

import { cookies } from 'next/headers'
import { fetchWithSentry } from '@/utils'
import { AccountType } from '@/interfaces'

const API_KEY = process.env.PEANUT_API_KEY!

export interface ExchangeRateResponse {
    from: string
    to: string
    midmarket_rate: string
    buy_rate: string
    sell_rate: string
    updated_at: string
}

/**
 * Server Action to fetch the current exchange rate for a given bank account type.
 *
 * This calls the `/bridge/exchange-rate` API endpoint.
 *
 * @param accountType - The type of bank account ('iban', 'us', 'clabe').
 * @returns An object containing either the successful response data or an error.
 */
export async function getExchangeRate(
    accountType: AccountType
): Promise<{ data?: ExchangeRateResponse; error?: string }> {
    const apiUrl = process.env.PEANUT_API_URL

    if (!apiUrl || !API_KEY) {
        console.error('API URL or API Key is not configured.')
        return { error: 'Server configuration error.' }
    }

    try {
        const cookieStore = await cookies()
        const jwtToken = cookieStore.get('jwt-token')?.value

        if (!jwtToken) {
            return { error: 'Authentication token not found.' }
        }

        const url = new URL(`${apiUrl}/bridge/exchange-rate`)
        url.searchParams.append('accountType', accountType)

        const response = await fetchWithSentry(url.toString(), {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${jwtToken}`,
                'api-key': API_KEY,
            },
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
