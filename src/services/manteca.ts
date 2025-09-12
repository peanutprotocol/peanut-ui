import { PEANUT_API_URL } from '@/constants'
import { fetchWithSentry } from '@/utils'
import Cookies from 'js-cookie'

export type WithdrawRequestType = {
    amount: string
    accountId: string
    depositAddress: string
}

export const mantecaApi = {
    initiateWithdraw: async (data: WithdrawRequestType) => {
        const response = await fetchWithSentry(`${PEANUT_API_URL}/manteca/withdraw`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${Cookies.get('jwt-token')}`,
            },
            body: JSON.stringify(data),
        })

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            throw new Error(errorData.message || `Withdraw failed: ${response.statusText}`)
        }

        return response.json()
    },
}
