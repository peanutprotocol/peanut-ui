import type { PixWithdrawDisplay } from '@/services/pix'
import type { HistoryEntry } from '@/utils/history.utils'
import { removeStoredValue, writeStoredValue } from '@/utils/safe-storage'

/**
 * A `transfer-then-submit` withdrawal whose submit may have gone out. It has no intent id until the
 * API answers, so the device mark (`pixWithdrawSent`) cannot hold it: this one does, by its price
 * lock, its key and its amount. It is written before the submit leaves and kept until the
 * withdrawal shows in history, the API refuses the submit, or the lock's window plus a margin has
 * passed. While it stands, the withdraw page shows the withdrawal as not confirmed yet, never a new
 * Confirm: a reload after a lost answer could otherwise send a second payout.
 */
export interface PendingTransfer {
    priceLockCode: string
    /** What the review showed: the last step's amount and destination. */
    display: PixWithdrawDisplay
    /** USDC the signed transfer moves: the history row's amount. */
    withdrawUsd: string
    submittedAt: number
    /** After this the API can no longer have taken the submit, and its row would show by now. */
    settleBy: number
}

/** The lock bounds the submit; history can lag the API's answer by a little. */
export const PENDING_TRANSFER_MARGIN_MS = 10 * 60_000
/** A row this much older than the submit is not its withdrawal (device clocks drift). */
const CLOCK_DRIFT_MS = 5 * 60_000
export const PENDING_TRANSFER_KEY = 'pix-withdraw-pending'

export function markTransferPending(pending: PendingTransfer): void {
    writeStoredValue(PENDING_TRANSFER_KEY, JSON.stringify(pending))
}

export function clearTransferPending(): void {
    removeStoredValue(PENDING_TRANSFER_KEY)
}

/** The stored mark as it was written, or null for none or one that does not parse. */
export function parsePendingTransfer(raw: string | null): PendingTransfer | null {
    if (!raw) return null
    try {
        const pending = JSON.parse(raw) as PendingTransfer
        return typeof pending?.settleBy === 'number' && typeof pending.withdrawUsd === 'string' ? pending : null
    } catch {
        return null
    }
}

/** The history row of the pending withdrawal: a withdrawal of its amount from the submit on. */
export function pendingTransferEntry(
    pending: Pick<PendingTransfer, 'withdrawUsd' | 'submittedAt'>,
    entries: readonly Pick<HistoryEntry, 'uuid' | 'amount' | 'timestamp' | 'extraData'>[]
): Pick<HistoryEntry, 'uuid'> | undefined {
    const usd = Number(pending.withdrawUsd)
    return entries.find(
        (entry) =>
            entry.extraData?.kind === 'OFFRAMP' &&
            new Date(entry.timestamp).getTime() >= pending.submittedAt - CLOCK_DRIFT_MS &&
            Math.abs(Number(entry.amount) - usd) < 0.01
    )
}
