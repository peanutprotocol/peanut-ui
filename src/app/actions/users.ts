'use server'

import { PEANUT_API_URL } from '@/constants'
import { ApiUser } from '@/services/users'
import { fetchWithSentry } from '@/utils'
import { cookies } from 'next/headers'
import { AddBankAccountPayload, BridgeEndorsementType, InitiateKycResponse } from './types/users.types'

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

// initiate the kyc process for the logged-in user
export const initiateKyc = async (params?: { endorsements: BridgeEndorsementType[] }): Promise<InitiateKycResponse> => {
    const cookieStore = cookies()
    const jwtToken = (await cookieStore).get('jwt-token')?.value

    const response = await fetchWithSentry(`${PEANUT_API_URL}/users/initiate-kyc`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${jwtToken}`,
            'api-key': API_KEY,
        },
        body: JSON.stringify(params || {}),
    })

    // the response will be parsed and returned. if the backend returned an error (e.g., 400 for a rejection),
    // the parsed json object will contain the `error` and `reasons` fields, which we handle in the calling component
    const responseJson = await response.json()
    if (!response.ok) {
        throw new Error(responseJson.error || 'Failed to initiate KYC')
    }
    return responseJson
}

export const addBankAccount = async (payload: AddBankAccountPayload): Promise<any> => {
    const cookieStore = cookies()
    const jwtToken = (await cookieStore).get('jwt-token')?.value

    const response = await fetchWithSentry(`${PEANUT_API_URL}/users/accounts`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${jwtToken}`,
            'api-key': API_KEY,
        },
        body: JSON.stringify(payload),
    })

    const responseJson = await response.json()
    if (!response.ok) {
        throw new Error(responseJson.error || `Failed to add bank account with status: ${response.status}`)
    }
    return responseJson
}
