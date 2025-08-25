'use server'

import { PEANUT_API_URL } from '@/constants'
import { ApiUser } from '@/services/users'
import { fetchWithSentry } from '@/utils'
import { cookies } from 'next/headers'
import { AddBankAccountPayload, BridgeEndorsementType, InitiateKycResponse } from './types/users.types'
import { User } from '@/interfaces'

const API_KEY = process.env.PEANUT_API_KEY!

export const updateUserById = async (payload: Record<string, any>): Promise<{ data?: ApiUser; error?: string }> => {
    const cookieStore = cookies()
    const jwtToken = (await cookieStore).get('jwt-token')?.value

    try {
        const response = await fetchWithSentry(`${PEANUT_API_URL}/update-user`, {
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
            return { error: responseJson.message || responseJson.error || 'Failed to update user' }
        }
        return { data: responseJson }
    } catch (e: any) {
        return { error: e.message || 'An unexpected error occurred' }
    }
}

// initiate the kyc process for the logged-in user
export const getKycDetails = async (params?: {
    endorsements: BridgeEndorsementType[]
}): Promise<{ data?: InitiateKycResponse; error?: string }> => {
    const cookieStore = cookies()
    const jwtToken = (await cookieStore).get('jwt-token')?.value
    try {
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
            return {
                error: responseJson.message || responseJson.error || 'Failed to initiate KYC',
                data: responseJson,
            }
        }
        return { data: responseJson }
    } catch (e: any) {
        return { error: e.message || 'An unexpected error occurred' }
    }
}

export const addBankAccount = async (payload: AddBankAccountPayload): Promise<{ data?: any; error?: string }> => {
    const cookieStore = cookies()
    const jwtToken = (await cookieStore).get('jwt-token')?.value

    try {
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
            return {
                error:
                    responseJson.message ||
                    responseJson.error ||
                    `Failed to add bank account with status: ${response.status}`,
            }
        }
        return { data: responseJson }
    } catch (e: any) {
        return { error: e.message || 'An unexpected error occurred' }
    }
}

export async function getUserById(userId: string): Promise<User | null> {
    try {
        const response = await fetchWithSentry(`${PEANUT_API_URL}/users/${userId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'api-key': API_KEY,
            },
        })

        if (!response.ok) {
            const errorData = await response.json()
            console.error(`Failed to fetch user ${userId}:`, errorData)
            return null
        }
        const responseJson = await response.json()

        return responseJson
    } catch (error) {
        console.error(`Error fetching user ${userId}:`, error)
        return null
    }
}

export async function saveDepositAddress(txHash: string, payerAddress: string): Promise<{ data?: any }> {
    try {
        if (!txHash || !payerAddress) {
            throw new Error('Missing required fields: txHash and payerAddress')
        }

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

        const responseJson = await response.json()
        if (!response.ok) {
            throw new Error(
                responseJson.message ||
                    responseJson.error ||
                    `Failed to save deposit address with status: ${response.status}`
            )
        }
        return { data: responseJson }
    } catch (e: any) {
        throw new Error(e.message || e.toString() || 'An unexpected error occurred')
    }
}
