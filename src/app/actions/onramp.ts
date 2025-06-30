'use server'

import { cookies } from 'next/headers'
import { fetchWithSentry } from '@/utils'

const API_KEY = process.env.PEANUT_API_KEY!

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
