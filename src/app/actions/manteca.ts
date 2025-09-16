'use server'

import { MantecaWithdrawData, MantecaWithdrawResponse } from '@/types/manteca.types'
import { fetchWithSentry } from '@/utils'
import { cookies } from 'next/headers'

const API_KEY = process.env.PEANUT_API_KEY!

export async function mantecaWithdraw(params: MantecaWithdrawData): Promise<MantecaWithdrawResponse> {
    const apiUrl = process.env.PEANUT_API_URL
    const cookieStore = cookies()
    const jwtToken = (await cookieStore).get('jwt-token')?.value

    if (!apiUrl || !API_KEY) {
        console.error('API URL or API Key is not configured.')
        return { error: 'Server configuration error.' }
    }

    try {
        const response = await fetchWithSentry(`${apiUrl}/manteca/withdraw`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${jwtToken}`,
                'api-key': API_KEY,
            },
            body: JSON.stringify(params),
        })

        const data = await response.json()

        if (!response.ok) {
            console.log('error', response)
            return { error: data.error || 'Failed to create manteca withdraw.' }
        }

        return { data }
    } catch (error) {
        console.log('error', error)
        console.error('Error calling create manteca withdraw API:', error)
        if (error instanceof Error) {
            return { error: error.message }
        }
        return { error: 'An unexpected error occurred.' }
    }
}
