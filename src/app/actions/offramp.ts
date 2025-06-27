'use server'

import { cookies } from 'next/headers'
import { TCreateOfframpRequest } from '../../services/services.types'
import { fetchWithSentry } from '@/utils'

const API_KEY = process.env.PEANUT_API_KEY!

export type CreateOfframpSuccessResponse = {
    transferId: string
    depositInstructions: {
        toAddress: string
        blockchainMemo?: string
    }
}

/**
 * server Action to initiate an off-ramp transfer.
 *
 * calls the `/bridge/offramp/create` API endpoint to create the transfer
 * and returns the provider's instructions for the user to deposit funds
 *
 * @param params - The data needed to create the off-ramp transfer.
 * @returns An object containing either the successful response data or an error.
 */
export async function createOfframp(
    params: TCreateOfframpRequest
): Promise<{ data?: CreateOfframpSuccessResponse; error?: string }> {
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

        const response = await fetchWithSentry(`${apiUrl}/bridge/offramp/create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${jwtToken}`,
                'api-key': API_KEY,
            },
            body: JSON.stringify({
                ...params,
                provider: 'bridge', // note: bridge is currently the only provider
            }),
        })

        const data = await response.json()

        if (!response.ok) {
            return { error: data.error || 'Failed to create off-ramp transfer.' }
        }

        return { data }
    } catch (error) {
        console.error('Error calling create off-ramp API:', error)
        if (error instanceof Error) {
            return { error: error.message }
        }
        return { error: 'An unexpected error occurred.' }
    }
}

/**
 * Server Action to confirm an off-ramp transfer after the user has sent funds.
 *
 * this calls the `/bridge/transfers/:transferId/confirm` API endpoint, providing
 * the on-chain transaction hash. This makes the transfer visible in the user's history.
 *
 * @param transferId - The ID of the transfer to confirm.
 * @param txHash - The on-chain transaction hash from the user's deposit.
 * @returns An object containing either the successful response data or an error.
 */
export async function confirmOfframp(
    transferId: string,
    txHash: string
): Promise<{ data?: { success: boolean }; error?: string }> {
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

        const response = await fetchWithSentry(`${apiUrl}/bridge/transfers/${transferId}/confirm`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${jwtToken}`,
                'api-key': API_KEY,
            },
            body: JSON.stringify({ txHash }),
        })

        if (!response.ok) {
            const data = await response.json()
            return { error: data.error || 'Failed to confirm off-ramp transfer.' }
        }

        return { data: { success: true } }
    } catch (error) {
        console.error('Error calling confirm off-ramp API:', error)
        if (error instanceof Error) {
            return { error: error.message }
        }
        return { error: 'An unexpected error occurred.' }
    }
}
