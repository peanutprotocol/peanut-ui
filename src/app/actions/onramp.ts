import { serverFetch } from '@/utils/api-fetch'

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
        const response = await serverFetch(`/bridge/onramp/${transferId}/cancel`, {
            method: 'DELETE',
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
