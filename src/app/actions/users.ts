import * as Sentry from '@/utils/sentry-lazy'
import { criticalFlowTags } from '@/utils/sentry-critical-flow'
import { type ApiUser } from '@/services/users'
import { type AddBankAccountPayload, type UpdateUserResult } from './types/users.types'
import { type CounterpartyUser } from '@/interfaces/interfaces'
import { type ContactsResponse } from '@/interfaces/interfaces'
import { serverFetch } from '@/utils/api-fetch'
import { kycClientHeaders } from '@/utils/kyc-client-headers'
import { withStepUpHeader } from '@/services/step-up'

export const updateUserById = async (payload: Record<string, unknown>): Promise<UpdateUserResult<ApiUser>> => {
    try {
        const requiresEmailStepUp = typeof payload.emailVerificationCode === 'string'
        const response = await serverFetch('/update-user', {
            method: 'POST',
            body: JSON.stringify(payload),
            // Setting the same fields twice is safe. A step-up proof may be
            // single-use, so a request that carries one is not resent.
            idempotent: !requiresEmailStepUp,
            ...(requiresEmailStepUp ? { headers: await withStepUpHeader({}) } : {}),
        })

        // A gateway error page is not JSON; its status still says what failed.
        const responseJson = await response.json().catch(() => undefined)
        if (!response.ok) {
            return {
                error: responseJson?.message || responseJson?.error || 'Failed to update user',
                failureKind: 'http',
                status: response.status,
            }
        }
        if (responseJson === undefined) return { error: 'Invalid response from the server', failureKind: 'other' }
        return { data: responseJson }
    } catch (e) {
        return {
            error: e instanceof Error ? e.message : 'An unexpected error occurred',
            failureKind: isRequestFailure(e) ? 'network' : 'other',
        }
    }
}

/** fetchWithSentry's errors for a request that got no response: a rejected fetch or a timeout. */
const isRequestFailure = (e: unknown): boolean =>
    e instanceof Error && (e.name === 'ServiceUnavailableError' || e.name === 'ConnectionTimeoutError')

export const requestEmailChange = async (email: string): Promise<{ error?: string }> => {
    const response = await serverFetch('/users/email-change', {
        method: 'POST',
        body: JSON.stringify({ email }),
        headers: await withStepUpHeader({}),
    })
    const body = await response.json()
    return response.ok ? {} : { error: body.error || 'Could not send verification code' }
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
                    responseJson.userMessage ||
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
    let status: number | undefined
    try {
        const response = await serverFetch('/users/bridge-tos-link', {
            method: 'GET',
            headers: kycClientHeaders(),
        })
        status = response.status
        const responseJson = await response.json()
        if (!response.ok) {
            if (response.status >= 500)
                Sentry.captureException(new Error('KYC terms request failed'), {
                    tags: { ...criticalFlowTags('kyc'), kyc_step: 'tos_open' },
                })
            return { error: responseJson.error || 'Failed to fetch Bridge ToS link' }
        }
        return { data: responseJson }
    } catch (e: unknown) {
        if (!(status !== undefined && status >= 400 && status < 500))
            Sentry.captureException(e, { tags: { ...criticalFlowTags('kyc'), kyc_step: 'tos_open' } })
        return { error: e instanceof Error ? e.message : 'An unexpected error occurred' }
    }
}

// confirm bridge ToS acceptance after user closes the ToS iframe
export const confirmBridgeTos = async (): Promise<{ data?: { accepted: boolean }; error?: string }> => {
    let status: number | undefined
    try {
        const response = await serverFetch('/users/bridge-tos-confirm', {
            method: 'POST',
            headers: kycClientHeaders(),
            body: JSON.stringify({}),
        })
        status = response.status
        const responseJson = await response.json()
        if (!response.ok) {
            if (response.status >= 500)
                Sentry.captureException(new Error('KYC terms request failed'), {
                    tags: { ...criticalFlowTags('kyc'), kyc_step: 'tos_confirm' },
                })
            return { error: responseJson.error || 'Failed to confirm Bridge ToS' }
        }
        return { data: responseJson }
    } catch (e: unknown) {
        if (!(status !== undefined && status >= 400 && status < 500))
            Sentry.captureException(e, { tags: { ...criticalFlowTags('kyc'), kyc_step: 'tos_confirm' } })
        return { error: e instanceof Error ? e.message : 'An unexpected error occurred' }
    }
}
