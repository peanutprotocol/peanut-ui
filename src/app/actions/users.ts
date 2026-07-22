import { type ApiUser } from '@/services/users'
import { type AddBankAccountPayload, BridgeEndorsementType, type InitiateKycResponse } from './types/users.types'
import { type CounterpartyUser } from '@/interfaces/interfaces'
import { type ContactsResponse } from '@/interfaces/interfaces'
import { serverFetch } from '@/utils/api-fetch'
import { withStepUpHeader } from '@/services/step-up'

export const updateUserById = async (payload: Record<string, unknown>): Promise<{ data?: ApiUser; error?: string }> => {
    try {
        const response = await serverFetch('/update-user', {
            method: 'POST',
            body: JSON.stringify(payload),
        })

        const responseJson = await response.json()
        if (!response.ok) {
            return { error: responseJson.message || responseJson.error || 'Failed to update user' }
        }
        return { data: responseJson }
    } catch (e) {
        return { error: e instanceof Error ? e.message : 'An unexpected error occurred' }
    }
}

// initiate the kyc process for the logged-in user
export const getKycDetails = async (params?: {
    endorsements: BridgeEndorsementType[]
}): Promise<{ data?: InitiateKycResponse; error?: string }> => {
    try {
        const response = await serverFetch('/users/initiate-kyc', {
            method: 'POST',
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
    } catch (e) {
        return { error: e instanceof Error ? e.message : 'An unexpected error occurred' }
    }
}

// shape of the account returned by POST /users/accounts, as consumed by callers
export interface AddedBankAccount {
    id: string
    type: string
    identifier?: string
    bridgeAccountId?: string
    bic?: string
    routingNumber?: string
    sortCode?: string
    firstName?: string
    lastName?: string
    details: { accountOwnerName?: string; countryCode?: string }
}

export const addBankAccount = async (
    payload: AddBankAccountPayload
): Promise<{ data?: AddedBankAccount; error?: string }> => {
    try {
        const response = await serverFetch('/users/accounts', {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: await withStepUpHeader({}),
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
    } catch (e) {
        return { error: e instanceof Error ? e.message : 'An unexpected error occurred' }
    }
}

export async function getUserById(userId: string): Promise<CounterpartyUser | null> {
    // Strip CRLF before logging so a hostile userId can't forge new log entries
    // (CodeQL js/log-injection + js/tainted-format-string).
    const safeUserId = String(userId).replace(/[\r\n]/g, '')
    try {
        const response = await serverFetch(`/users/${userId}`, {
            method: 'GET',
        })

        if (!response.ok) {
            const errorData = await response.json()
            console.error(`Failed to fetch user ${safeUserId}:`, errorData)
            return null
        }
        const responseJson = await response.json()

        return responseJson
    } catch (error) {
        console.error(`Error fetching user ${safeUserId}:`, error)
        return null
    }
}

export async function getContacts(params: {
    limit: number
    offset: number
    search?: string
}): Promise<{ data?: ContactsResponse; error?: string }> {
    try {
        const queryParams = new URLSearchParams({
            limit: params.limit.toString(),
            offset: params.offset.toString(),
        })

        // add search param if provided
        if (params.search?.trim()) {
            queryParams.append('search', params.search.trim())
        }

        const response = await serverFetch(`/users/contacts?${queryParams}`, {
            method: 'GET',
        })

        if (!response.ok) {
            const errorJson = await response.json()
            return { error: errorJson.message || errorJson.error || 'Failed to fetch contacts' }
        }

        const responseJson: ContactsResponse = await response.json()
        return { data: responseJson }
    } catch (e: unknown) {
        return { error: e instanceof Error ? e.message : 'An unexpected error occurred' }
    }
}

// fetch bridge ToS acceptance link for users with pending ToS
export const getBridgeTosLink = async (): Promise<{ data?: { tosLink: string }; error?: string }> => {
    try {
        const response = await serverFetch('/users/bridge-tos-link', {
            method: 'GET',
        })
        const responseJson = await response.json()
        if (!response.ok) {
            return { error: responseJson.error || 'Failed to fetch Bridge ToS link' }
        }
        return { data: responseJson }
    } catch (e: unknown) {
        return { error: e instanceof Error ? e.message : 'An unexpected error occurred' }
    }
}

// confirm bridge ToS acceptance after user closes the ToS iframe
export const confirmBridgeTos = async (): Promise<{ data?: { accepted: boolean }; error?: string }> => {
    try {
        const response = await serverFetch('/users/bridge-tos-confirm', {
            method: 'POST',
            body: JSON.stringify({}),
        })
        const responseJson = await response.json()
        if (!response.ok) {
            return { error: responseJson.error || 'Failed to confirm Bridge ToS' }
        }
        return { data: responseJson }
    } catch (e: unknown) {
        return { error: e instanceof Error ? e.message : 'An unexpected error occurred' }
    }
}
