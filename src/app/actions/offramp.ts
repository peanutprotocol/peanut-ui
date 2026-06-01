import { type TCreateOfframpRequest } from '../../services/services.types'
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
): Promise<{ data?: CreateOfframpSuccessResponse; error?: string }> {
    try {
        const response = await serverFetch('/bridge/offramp/create', {
            method: 'POST',
            body: JSON.stringify({
                ...params,
                provider: 'bridge', // note: bridge is currently the only provider
            }),
        })

        const data = await response.json()

        if (!response.ok) {
            return { error: data.error || 'Failed to create off-ramp transfer.' }
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

export async function createOfframpForGuest(
    params: TCreateOfframpRequest
): Promise<{ data?: CreateOfframpSuccessResponse; error?: string }> {
    try {
        const response = await serverFetch('/bridge/offramp/create-for-guest', {
            method: 'POST',
            body: JSON.stringify({
                ...params,
                provider: 'bridge',
            }),
        })

        const data = await response.json()

        if (!response.ok) {
            return { error: data.error || 'Failed to create off-ramp transfer for guest.' }
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
/**
 * Look up an off-ramp intent by the on-chain tx hash the user submitted to
 * confirm it. Backed by `GET /bridge/transfers/by-tx-hash/:txHash` — added in
 * peanut-api-ts #929 as the recovery counterpart to /confirm's new idempotency.
 *
 * Use case: user reloaded the page (or app was killed) mid-flow after the
 * on-chain leg fired. React state is gone, but the wallet still has the tx
 * hash. We ask the BE "do you know this hash?" to surface the in-progress
 * state instead of letting the user re-trigger a fresh withdraw and double-pay.
 * Returns null on any 4xx (no match / not yours) — only logs unexpected errors.
 */
export type OfframpByTxHash = {
    intentId: string
    transferId: string
    status: string
    bridgeState: string | null
    userSubmittedTxHash: string | null
    updatedAt: string
}

export async function getOfframpByTxHash(txHash: string): Promise<OfframpByTxHash | null> {
    try {
        const response = await serverFetch(`/bridge/transfers/by-tx-hash/${encodeURIComponent(txHash)}`, {
            method: 'GET',
        })
        if (response.status === 404) return null
        if (!response.ok) {
            console.warn(`getOfframpByTxHash: unexpected status ${response.status} for ${txHash}`)
            return null
        }
        return (await response.json()) as OfframpByTxHash
    } catch (error) {
        // Network error / timeout — treat as "unknown" so callers can render
        // the form normally instead of getting stuck on a recovery query.
        console.error('Error calling getOfframpByTxHash:', error)
        return null
    }
}

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
