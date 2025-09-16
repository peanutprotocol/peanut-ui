'use server'

import { cookies } from 'next/headers'
import { fetchWithSentry } from '@/utils'
import { CountryData } from '@/components/AddMoney/consts'
import { MantecaDepositDetails } from '@/types/manteca.types'
import { getCurrencyConfig } from '@/utils/bridge.utils'
import { getCurrencyPrice } from '@/app/actions/currency'

const API_KEY = process.env.PEANUT_API_KEY!

export interface CreateOnrampGuestParams {
    amount: string
    country: CountryData
    userId: string
    chargeId?: string
}

/**
 * Server Action to cancel an on-ramp transfer.
 *
 * calls the `/bridge/onramp/:transferId/cancel` API endpoint to cancel the transfer
 * and returns the success status or error message.
 *
 * @param transferId - The ID of the transfer to cancel.
 * @returns An object containing either the successful response data or an error.
 */
export async function cancelOnramp(transferId: string): Promise<{ data?: { success: boolean }; error?: string }> {
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

        const response = await fetchWithSentry(`${apiUrl}/bridge/onramp/${transferId}/cancel`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${jwtToken}`,
                'api-key': API_KEY,
            },
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
    const apiUrl = process.env.PEANUT_API_URL

    if (!apiUrl || !API_KEY) {
        console.error('API URL or API Key is not configured.')
        return { error: 'Server configuration error.' }
    }

    try {
        const { currency, paymentRail } = getCurrencyConfig(params.country.id, 'onramp')
        const price = await getCurrencyPrice(currency)
        const amount = (Number(params.amount) * price.buy).toFixed(2)

        const response = await fetchWithSentry(`${apiUrl}/bridge/onramp/create-for-guest`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': API_KEY,
            },
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

interface CreateMantecaOnrampParams {
    usdAmount: string
    currency: string
}

export async function createMantecaOnramp(
    params: CreateMantecaOnrampParams
): Promise<{ data?: MantecaDepositDetails; error?: string }> {
    const apiUrl = process.env.PEANUT_API_URL
    const cookieStore = cookies()
    const jwtToken = (await cookieStore).get('jwt-token')?.value

    if (!apiUrl || !API_KEY) {
        console.error('API URL or API Key is not configured.')
        return { error: 'Server configuration error.' }
    }

    try {
        const response = await fetchWithSentry(`${apiUrl}/manteca/deposit`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${jwtToken}`,
                'api-key': API_KEY,
            },
            body: JSON.stringify({
                usdAmount: params.usdAmount,
                currency: params.currency,
            }),
        })

        const data = await response.json()

        if (!response.ok) {
            console.log('error', response)
            return { error: data.error || 'Failed to create on-ramp transfer for guest.' }
        }

        return { data }
    } catch (error) {
        console.error('Error calling create manteca on-ramp API:', error)
        if (error instanceof Error) {
            return { error: error.message }
        }
        return { error: 'An unexpected error occurred.' }
    }
}
