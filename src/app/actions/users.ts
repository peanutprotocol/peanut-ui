'use server'

import { PEANUT_API_URL } from '@/constants'
import { ApiUser } from '@/services/users'
import { fetchWithSentry } from '@/utils'
import { cookies } from 'next/headers'

const API_KEY = process.env.PEANUT_API_KEY!

export const updateUserById = async (payload: Record<string, any>): Promise<ApiUser> => {
    const cookieStore = cookies()
    const jwtToken = (await cookieStore).get('jwt-token')?.value

    const response = await fetchWithSentry(`${PEANUT_API_URL}/update-user`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${jwtToken}`,
            'api-key': API_KEY,
        },
        body: JSON.stringify(payload),
    })

    return await response.json()
}
