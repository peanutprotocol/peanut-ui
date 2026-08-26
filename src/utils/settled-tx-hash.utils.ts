import type { Hash } from 'viem'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { isDemoMode } from '@/utils/demo'

export interface SettledTxResult {
    receipt?: { transactionHash: Hash } | null
    userOpHash?: Hash
    txHash?: Hash
}

/**
 * Pick the hash to record a payment with, preferring the REAL transaction
 * hash from the receipt. A userOp hash is a bundler-internal identifier —
 * `eth_getTransactionReceipt` can never resolve it, so recording it poisons
 * backend validation (TASK-21147: 11 successful sends/month marked FAILED
 * after the validator burned its full retry window on an unfindable hash).
 *
 * The userOpHash fallback is kept as a last resort (the flow would otherwise
 * have nothing to record), but every use of it is captured to PostHog so the
 * residual rate is measurable. `txHash` covers the collateral-only strategy,
 * where the Rain coordinator submits the real transaction itself.
 */
export function resolveSettledTxHash(
    txResult: SettledTxResult,
    flow: string
): { hash: Hash; source: 'receipt' | 'txHash' | 'userOpHash' } {
    const receiptHash = txResult.receipt?.transactionHash
    if (receiptHash) return { hash: receiptHash, source: 'receipt' }
    if (txResult.txHash) return { hash: txResult.txHash, source: 'txHash' }
    // No hash at all is a caller bug — fail loudly instead of returning
    // undefined-as-Hash and letting recordPayment POST txHash: undefined.
    if (!txResult.userOpHash) throw new Error('resolveSettledTxHash: txResult carries no transaction identifier')
    // Demo mode fabricates a userOpHash by design — keep it out of the
    // "should be ~0" prod metric.
    if (!isDemoMode()) posthog.capture(ANALYTICS_EVENTS.SEND_TXHASH_FALLBACK, { flow })
    return { hash: txResult.userOpHash, source: 'userOpHash' }
}
