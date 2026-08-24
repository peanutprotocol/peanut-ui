import type { Hash, TransactionReceipt } from 'viem'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { isDemoMode } from '@/utils/demo'

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
 * Retries the wait once, wall-clock capped, UNLESS the original failure was
 * a genuinely exhausted timeout (more polling has ~zero rescue odds).
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
    const start = Date.now()
    const rescued = await client.waitForUserOperationReceipt({ hash: userOpHash, timeout: timeoutMs }).catch(() => null)
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
