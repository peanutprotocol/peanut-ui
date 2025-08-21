import { PEANUT_API_URL } from '@/constants'
import { fetchWithSentry } from '@/utils'

const API_KEY = process.env.PEANUT_API_KEY!

export async function updateDepositorAddress({ txHash, payerAddress }: { txHash: string; payerAddress: string }) {
    try {
        const response = await fetchWithSentry(`${PEANUT_API_URL}/users/history/deposit`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'api-key': API_KEY,
            },
            body: JSON.stringify({
                txHash,
                payerAddress,
            }),
        })
        if (!response.ok) {
            const errorData = await response.json()
            console.error(`Failed to update depositor address:`, errorData)
            return null
        }
        const responseJson = await response.json()

        return responseJson
    } catch (error) {
        console.error(`Error updating depositor address:`, error)
        return null
    }
}
