import { getAuthToken } from '@/utils/auth-token'
import { type JSONObject } from '@/interfaces'
import { fetchWithSentry } from '@/utils/sentry.utils'
import { PEANUT_API_URL } from '@/constants/general.consts'

export async function hitUserMetric(userId: string, name: string, value: JSONObject = {}): Promise<void> {
    try {
        await fetchWithSentry(`${PEANUT_API_URL}/users/${userId}/metrics/${name}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${getAuthToken()}`,
            },
            body: JSON.stringify(value),
        })
    } catch (error) {
        console.error(`Unexpected error while hitting user metric ${name}`, error)
    }
}
