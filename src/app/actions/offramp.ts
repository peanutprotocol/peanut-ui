import {
    type OfframpQuote,
    type TCreateGuestOfframpRequest,
    type TCreateOfframpRequest,
} from '../../services/services.types'
import { serverFetch } from '@/utils/api-fetch'

export type CreateOfframpSuccessResponse = {
    transferId: string
    depositInstructions: {
        toAddress: string
        blockchainMemo?: string
    }
}

/**
 * Initiate an off-ramp transfer.
 *
 * calls the `/bridge/offramp/create` API endpoint to create the transfer
 * and returns the provider's instructions for the user to deposit funds
 *
 * @param params - The data needed to create the off-ramp transfer.
 * @returns An object containing either the successful response data or an error.
 */
export async function createOfframp(
    params: TCreateOfframpRequest
): Promise<{ data?: CreateOfframpSuccessResponse; error?: string; code?: string; status?: number }> {
    try {
        const response = await serverFetch('/bridge/offramp/create', {
            method: 'POST',
            body: JSON.stringify({
                ...params,
                provider: 'bridge', // note: bridge is currently the only provider
            }),
            // The first withdraw on a rail grants the endorsement inside this
            // request, and that grant polls the provider before the transfer
            // is even created. The default client budget is 20s, so the
            // browser could abort mid-grant; an abort that lands after the
            // transfer exists leaves an orphan, and the retry creates a second
            // one. Same budget confirm already takes, for the same reason.
            timeoutMs: 60_000,
        })

        const data = await response.json()

        if (!response.ok) {
            return {
                error: data.error || 'Failed to create off-ramp transfer.',
                code: data.code,
                status: response.status,
            }
        }

        return { data }
    } catch (error) {
        console.error('Error calling create off-ramp API:', error)
        if (error instanceof Error) {
            return { error: error.message }
        }
        return { error: 'An unexpected error occurred.' }
    }
}

/**
 * Quote a withdrawal typed in the bank currency: the USDC that pays that
 * amount at the current rate. Without `destinationAmount`, only the rate.
 */
export async function getOfframpQuote(
    destinationCurrency: string,
    destinationAmount?: string
): Promise<{ data?: OfframpQuote; error?: string }> {
    try {
        const query = new URLSearchParams({ destinationCurrency })
        if (destinationAmount) query.set('destinationAmount', destinationAmount)
        const response = await serverFetch(`/bridge/offramp/quote?${query.toString()}`, { method: 'GET' })
        const data = await response.json()
        if (!response.ok) {
            return { error: data.error || 'Failed to get the offramp quote.' }
        }
        return { data }
    } catch (error) {
        console.error('Error calling offramp quote API:', error)
        return { error: error instanceof Error ? error.message : 'An unexpected error occurred.' }
    }
}

/**
 * Claim a send link to a bank account as a guest. The API resolves the sender
 * from the link and checks `signature` — the link key's signature over
 * guestBankClaimMessage(sendLinkPubKey, destination.externalAccountId).
 * A repeat to the same account returns the same transfer.
 */
export async function createOfframpForGuest(
    params: TCreateGuestOfframpRequest
): Promise<{ data?: CreateOfframpSuccessResponse; error?: string; code?: string; status?: number }> {
    try {
        const response = await serverFetch('/bridge/offramp/create-for-guest', {
            method: 'POST',
            body: JSON.stringify(params),
            // the guest's name, address and link signature must not reach telemetry
            redactTelemetry: true,
            // same budget as createOfframp: the endorsement grant can run inside this request
            timeoutMs: 60_000,
        })

        const data = await response.json()

        if (!response.ok) {
            return {
                error: data.error || 'Failed to create off-ramp transfer for guest.',
                code: data.code,
                status: response.status,
            }
        }

        return { data }
    } catch (error) {
        console.error('Error calling create off-ramp for guest API:', error)
        if (error instanceof Error) {
            return { error: error.message }
        }
        return { error: 'An unexpected error occurred.' }
    }
}

/**
 * Confirm an off-ramp transfer after the user has sent funds.
 *
 * this calls the `/bridge/transfers/:transferId/confirm` API endpoint, providing
 * the on-chain transaction hash. This makes the transfer visible in the user's history.
 *
 * NOTE: this is called AFTER the on-chain deposit has already succeeded — the
 * user's money is already at the Bridge deposit address. A timeout here is
 * NOT safe to blindly retry from the wallet side (that would re-send funds).
 * We bump the timeout well above the 10s default so the BE has time to write
 * the transfer row + send confirmation, matching the long-running confirm
 * pattern used by manteca.ts / rain.ts. Callers must additionally distinguish
 * "on-chain succeeded, confirm failed" from "on-chain never happened" before
 * surfacing a Retry action.
 *
 * @param transferId - The ID of the transfer to confirm.
 * @param txHash - The on-chain transaction hash from the user's deposit.
 * @returns An object containing either the successful response data or an error.
 */
export async function confirmOfframp(
    transferId: string,
    txHash: string
): Promise<{ data?: { success: boolean }; error?: string }> {
    try {
        const response = await serverFetch(`/bridge/transfers/${transferId}/confirm`, {
            method: 'POST',
            body: JSON.stringify({ txHash }),
            timeoutMs: 60_000,
        })

        if (!response.ok) {
            const data = await response.json()
            return { error: data.error || 'Failed to confirm off-ramp transfer.' }
        }

        return { data: { success: true } }
    } catch (error) {
        console.error('Error calling confirm off-ramp API:', error)
        if (error instanceof Error) {
            return { error: error.message }
        }
        return { error: 'An unexpected error occurred.' }
    }
}
