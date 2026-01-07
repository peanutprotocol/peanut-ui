'use server'

import { fetchWithSentry } from '@/utils/sentry.utils'
import { PEANUT_API_URL } from '@/constants/general.consts'

const API_KEY = process.env.PEANUT_API_KEY!

export async function validateInviteCode(
    inviteCode: string
): Promise<{ data?: { success: boolean; username: string }; error?: string }> {
    const apiUrl = PEANUT_API_URL

    if (!apiUrl || !API_KEY) {
        console.error('API URL or API Key is not configured.')
        return { error: 'Server configuration error.' }
    }

    try {
        const response = await fetchWithSentry(`${apiUrl}/invites/validate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': API_KEY,
            },
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
