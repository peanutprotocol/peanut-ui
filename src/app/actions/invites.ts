
import { fetchWithSentry } from '@/utils/sentry.utils'
import { PEANUT_API_URL } from '@/constants/general.consts'
import { getAuthHeaders } from '@/utils/auth-token'

export async function validateInviteCode(
    inviteCode: string
): Promise<{ data?: { success: boolean; username: string }; error?: string }> {
    try {
        const response = await fetchWithSentry(`${PEANUT_API_URL}/invites/validate`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ inviteCode }),
        })

        if (!response.ok) {
            const data = await response.json()
            return { error: data.error || 'Failed to validate invite code.' }
        }

        const data = await response.json()

        return { data: { success: true, username: data.username } }
    } catch (error) {
        console.error('Error calling validate invite code API:', error)
        if (error instanceof Error) {
            return { error: error.message }
        }
        return { error: 'An unexpected error occurred.' }
    }
}
