import type { Hash, TransactionReceipt } from 'viem'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { isDemoMode } from '@/utils/demo'

/**
 * The revert error every send path already threw, now carrying proof when —
 * and ONLY when — the receipt reported `success === false`. A missing or
 * malformed `success` is not proof: the error is still thrown (unchanged
 * message and behaviour), just without the flag, so nothing may replay it.
 */
export function userOpRevertedError(userOpHash: Hash, receiptSuccess?: boolean): Error {
    const error = new Error(`UserOperation reverted on-chain (userOpHash ${userOpHash})`)
    return receiptSuccess === false ? Object.assign(error, { userOpReverted: true as const }) : error
}

export function isUserOpRevertedError(error: unknown): boolean {
    return !!error && typeof error === 'object' && (error as { userOpReverted?: unknown }).userOpReverted === true
}

/** The slice of a bundler client the rescue needs. */
export interface UserOpReceiptWaiter {
    waitForUserOperationReceipt(args: {
        hash: Hash
        timeout?: number
    }): Promise<{ success: boolean; receipt: TransactionReceipt }>
}

/**
 * Bounded rescue after `waitForUserOperationReceipt` failed. viem's wait
 * rejects on the FIRST RPC error that is not "receipt not found" — a single
 * transport blip aborts an otherwise-healthy 120s wait, and a null receipt
 * makes send flows fall back to recording the userOp hash, which backend
 * validation can never resolve (TASK-21147).
 *
 * Waits again, wall-clock capped (see `waitForUserOpReceiptOrNull`), UNLESS
 * the original failure was a genuinely exhausted timeout. Payment flows can
 * fall back to the userOp hash, so they skip that case; send links cannot
 * and wait anyway (TASK-24270).
 *
 * Returns the FULL userOp receipt (`success` flag included) or null. The
 * caller decides what a rescued-but-REVERTED op means for its flow — a
 * payment flow must fail it, the migration noop must inspect the receipt.
 * A successful rescue is captured to PostHog (skipped in demo mode).
 */
export async function rescueUserOpReceipt(
    client: UserOpReceiptWaiter,
    userOpHash: Hash,
    originalError: unknown,
    context: string,
    { timeoutMs = 15_000 }: { timeoutMs?: number } = {}
): Promise<{ success: boolean; receipt: TransactionReceipt } | null> {
    if ((originalError as Error)?.name === 'WaitForUserOperationReceiptTimeoutError') return null
    return waitForUserOpReceiptOrNull(client, userOpHash, context, { timeoutMs })
}

/** Pause before asking again after an RPC error that was not a timeout. */
const RECEIPT_RETRY_PAUSE_MS = 1_000

/**
 * One more wall-clock-capped wait for a userOp receipt, with the same rescue
 * telemetry. viem's wait rejects on the FIRST RPC error that is not "receipt
 * not found", so this asks again after such an error until the deadline; only
 * the deadline itself ends it. Unlike `rescueUserOpReceipt` it also runs after
 * a genuine timeout: for a flow that cannot finish without the receipt (a
 * send link needs the vault's deposit index), a late op is worth the wait.
 * Seen on 2026-10-31: an op landed 7 s after the 120 s wait gave up
 * (TASK-24270).
 */
export async function waitForUserOpReceiptOrNull(
    client: UserOpReceiptWaiter,
    userOpHash: Hash,
    context: string,
    { timeoutMs }: { timeoutMs: number }
): Promise<{ success: boolean; receipt: TransactionReceipt } | null> {
    const start = Date.now()
    const deadline = start + timeoutMs
    let rescued: { success: boolean; receipt: TransactionReceipt } | null = null
    for (let left = timeoutMs; !rescued && left > 0; left = deadline - Date.now()) {
        try {
            // viem treats a timeout of 0 as no timeout, so `left` is always > 0 here.
            rescued = await client.waitForUserOperationReceipt({ hash: userOpHash, timeout: left })
        } catch (error) {
            if ((error as Error)?.name === 'WaitForUserOperationReceiptTimeoutError') break
            await new Promise((resolve) => setTimeout(resolve, Math.min(RECEIPT_RETRY_PAUSE_MS, left)))
        }
    }
    if (rescued) {
        try {
            if (!isDemoMode()) {
                posthog.capture(ANALYTICS_EVENTS.SEND_RECEIPT_RESCUED, {
                    elapsed_ms: Date.now() - start,
                    context,
                    reverted: !rescued.success,
                })
            }
        } catch {
            // analytics only
        }
    }
    return rescued
}
