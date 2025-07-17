'use server'

import { fetchWithSentry } from '@/utils'
import { AddBankAccountPayload } from './types/users.types'

const API_KEY = process.env.PEANUT_API_KEY!
const API_URL = process.env.PEANUT_API_URL!

export async function createBridgeExternalAccountForGuest(
    customerId: string,
    accountDetails: AddBankAccountPayload
): Promise<{ id: string } | { error: string }> {
    try {
        const response = await fetchWithSentry(`${API_URL}/bridge/customers/${customerId}/external-accounts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': API_KEY,
            },
            body: JSON.stringify(accountDetails),
        })

        const data = await response.json()

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
