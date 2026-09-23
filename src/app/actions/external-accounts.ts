import { type AddBankAccountPayload } from './types/users.types'
import { serverFetch } from '@/utils/api-fetch'

/**
 * What the API returns to a guest for an account it created on the link
 * sender's Bridge customer. It never names the customer or the owner.
 */
export interface GuestClaimExternalAccount {
    id: string
    account_type: string
    currency?: string
    bank_name?: string
    last_4: string
}

export type GuestClaimRequestError = { error: string; code?: string; status?: number; source?: string }

/**
 * Add the guest's bank account for a send-link claim. The API resolves the
 * sender from the link; `signature` is the link key's signature over
 * guestBankAccountMessage(sendLinkPubKey).
 */
export async function createGuestClaimExternalAccount(
    sendLinkPubKey: string,
    signature: string,
    accountDetails: AddBankAccountPayload & { country: string }
): Promise<GuestClaimExternalAccount | GuestClaimRequestError> {
    try {
        const response = await serverFetch('/bridge/guest-claim/external-accounts', {
            method: 'POST',
            // bank details — keep them out of fetch telemetry
            redactTelemetry: true,
            // reuseOnError: a guest who retries with the same account gets it back instead of an error
            body: JSON.stringify({ ...accountDetails, reuseOnError: true, sendLinkPubKey, signature }),
        })

        const data = await response.json()

        if (data?.code === 'invalid_parameters') {
            const source = typeof data.source === 'string' ? data.source : data?.source?.key
            return { error: data?.message ?? 'Invalid parameters', source }
        }

        if (!response.ok) {
            return {
                error: data.error || 'Failed to create external account.',
                code: data.code,
                status: response.status,
            }
        }

        return data
    } catch (error) {
        console.error('Error creating external account for a guest claim:', error)
        if (error instanceof Error) {
            return { error: error.message }
        }
        return { error: 'An unexpected error occurred.' }
    }
}
