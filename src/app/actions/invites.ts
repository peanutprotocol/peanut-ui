import { serverFetch } from '@/utils/api-fetch'

export async function validateInviteCode(
    inviteCode: string
): Promise<{ data?: { success: boolean; username: string }; error?: string }> {
    try {
        const response = await serverFetch('/invites/validate', {
            method: 'POST',
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
