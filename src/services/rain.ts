/**
 * Rain Card API Service
 *
 * Thin client wrapper over the server action for the composite
 * `GET /rain/cards` endpoint. Used by `useRainCardOverview` and
 * anywhere else that needs the authoritative card-section state.
 */

import {
    getRainCardOverview,
    prepareRainWithdrawal,
    stampRainWithdrawal,
    submitRainWithdrawal,
} from '@/app/actions/rain'
import type {
    PrepareRainWithdrawalInput,
    PrepareRainWithdrawalResponse,
    RainCardApplicationStatus,
    RainCardBalance,
    RainCardOverview,
    RainCardSummary,
    SubmitRainWithdrawalInput,
    SubmitRainWithdrawalResponse,
    TransactionIntentKind,
} from '@/app/actions/rain'

export type {
    PrepareRainWithdrawalInput,
    PrepareRainWithdrawalResponse,
    RainCardApplicationStatus,
    RainCardBalance,
    RainCardOverview,
    RainCardSummary,
    SubmitRainWithdrawalInput,
    SubmitRainWithdrawalResponse,
    TransactionIntentKind,
}

export const rainApi = {
    /** Authoritative card-section state: status + balance + cards. */
    getOverview: async (): Promise<RainCardOverview> => {
        const result = await getRainCardOverview()
        if (result.error || !result.data) {
            throw new Error(result.error || 'Failed to load card overview')
        }
        return result.data
    },

    /** Stage a Rain withdrawal so the user can sign the admin EIP-712 payload. */
    prepareWithdrawal: async (input: PrepareRainWithdrawalInput): Promise<PrepareRainWithdrawalResponse> => {
        const result = await prepareRainWithdrawal(input)
        if (result.error || !result.data) {
            throw new Error(result.error || 'Failed to prepare withdrawal')
        }
        return result.data
    },

    /** Submit a prepared withdrawal with the user's admin signature. */
    submitWithdrawal: async (input: SubmitRainWithdrawalInput): Promise<SubmitRainWithdrawalResponse> => {
        const result = await submitRainWithdrawal(input)
        if (result.error || !result.data) {
            throw new Error(result.error || 'Failed to submit withdrawal')
        }
        return result.data
    },

    /** Stamp a client-submitted mixed-strategy UserOp with its on-chain tx hash. */
    stampWithdrawal: async (input: { preparationId: string; txHash: string }): Promise<void> => {
        const result = await stampRainWithdrawal(input)
        if (result.error) {
            // Non-fatal: intent stays PENDING until expiry, no history categorization
            // until then. Log loudly but don't block the user.
            console.warn('[rainApi.stampWithdrawal] failed:', result.error)
        }
    },
}
