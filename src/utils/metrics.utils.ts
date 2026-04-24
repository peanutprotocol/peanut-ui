import { type JSONObject } from '@/interfaces'
import { serverFetch } from '@/utils/api-fetch'

export async function hitUserMetric(userId: string, name: string, value: JSONObject = {}): Promise<void> {
    try {
        await serverFetch(`/users/${userId}/metrics/${name}`, {
            method: 'POST',
            body: JSON.stringify(value),
        })
    } catch (error) {
        console.error(`Unexpected error while hitting user metric ${name}`, error)
    }
}
