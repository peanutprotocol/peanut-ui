'use server'

import { fetchWithSentry } from '@/utils/sentry.utils'
import { type AddBankAccountPayload } from './types/users.types'
import { type IBridgeAccount } from '@/interfaces'

const API_KEY = process.env.PEANUT_API_KEY!
const API_URL = process.env.PEANUT_API_URL!

export async function createBridgeExternalAccountForGuest(
    customerId: string,
    accountDetails: AddBankAccountPayload
): Promise<IBridgeAccount | { error: string; source?: string }> {
    try {
        const response = await fetchWithSentry(`${API_URL}/bridge/customers/${customerId}/external-accounts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': API_KEY,
            },
            body: JSON.stringify({ ...accountDetails, reuseOnError: true }), // note: reuseOnError is used to avoid showing errors for duplicate accounts on guest flow
        })

        const data = await response.json()

        if (data?.code === 'invalid_parameters') {
            const source = typeof data.source === 'string' ? data.source : data?.source?.key
            return { error: data?.message ?? 'Invalid parameters', source }
        }

        if (!response.ok) {
            return { error: data.error || 'Failed to create external account.' }
        }

        return data
    } catch (error) {
        console.error(`Error creating external account for ${customerId}:`, error)
        if (error instanceof Error) {
            return { error: error.message }
        }
        return { error: 'An unexpected error occurred.' }
    }
}
