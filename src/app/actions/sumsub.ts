'use server'

import { type InitiateSumsubKycResponse, type KYCRegionIntent } from './types/sumsub.types'
import { fetchWithSentry } from '@/utils/sentry.utils'
import { PEANUT_API_URL } from '@/constants/general.consts'
import { getJWTCookie } from '@/utils/cookie-migration.utils'

const API_KEY = process.env.PEANUT_API_KEY!

// initiate kyc flow (using sumsub) and get websdk access token
export const initiateSumsubKyc = async (params?: {
    regionIntent?: KYCRegionIntent
}): Promise<{ data?: InitiateSumsubKycResponse; error?: string }> => {
    const jwtToken = (await getJWTCookie())?.value

    try {
        const response = await fetchWithSentry(`${PEANUT_API_URL}/users/identity`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${jwtToken}`,
                'api-key': API_KEY,
            },
            body: JSON.stringify(params || {}),
        })

        const responseJson = await response.json()

        if (!response.ok) {
            return { error: responseJson.message || responseJson.error || 'Failed to initiate identity verification' }
        }

        return {
            data: {
                token: responseJson.token,
                applicantId: responseJson.applicantId,
                status: responseJson.status,
            },
        }
    } catch (e: any) {
        return { error: e.message || 'An unexpected error occurred' }
    }
}
