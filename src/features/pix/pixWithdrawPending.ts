import type { PixWithdrawDisplay } from '@/services/pix'
import { readStoredValue, removeStoredValue, writeStoredValue } from '@/utils/safe-storage'

/**
 * A `transfer-then-submit` withdrawal whose submit may have gone out. It has no intent id until the
 * API answers, so the device mark (`pixWithdrawSent`) cannot hold it: this one does. It is written
 * before the submit leaves and kept until the API refuses the submit, the answer names the
 * withdrawal, or the lock's window plus a margin has passed. While it stands, the withdraw page
 * shows the withdrawal as not confirmed yet, never a new Confirm: a reload after a lost answer could
 * otherwise send a second payout.
 *
 * Nothing in history names the price lock or the submit, so the mark is never matched against a
 * row by its amount or time (an earlier withdrawal of the same amount would lift it): it stands
 * until its deadline. It belongs to one account: another account's mark is never shown, and
 * logout clears it.
 */
export interface PendingTransfer {
    /** The account that submitted it. */
    userId: string
    priceLockCode: string
    /** What the review showed: the last step's amount and destination. */
    display: PixWithdrawDisplay
    submittedAt: number
    /** After this the API can no longer have taken the submit, and its row would show in history. */
    settleBy: number
}

/** The lock bounds the submit; history can lag the API's answer by a little. */
export const PENDING_TRANSFER_MARGIN_MS = 10 * 60_000
export const PENDING_TRANSFER_KEY = 'pix-withdraw-pending'
const PROBE_KEY = 'pix-withdraw-pending-probe'

/** Writes the mark and reads it back: false when this browser could not keep it. */
export function markTransferPending(pending: PendingTransfer): boolean {
    const value = JSON.stringify(pending)
    writeStoredValue(PENDING_TRANSFER_KEY, value)
    return readStoredValue(PENDING_TRANSFER_KEY) === value
}

/** Whether this browser can keep a mark at all (storage blocked, full or private): asked before signing. */
export function canKeepTransferMark(): boolean {
    const value = String(Date.now())
    writeStoredValue(PROBE_KEY, value)
    const kept = readStoredValue(PROBE_KEY) === value
    removeStoredValue(PROBE_KEY)
    return kept
}

export function clearTransferPending(): void {
    removeStoredValue(PENDING_TRANSFER_KEY)
}

/** The stored mark as it was written, or null for none or one that does not parse. */
export function parsePendingTransfer(raw: string | null): PendingTransfer | null {
    if (!raw) return null
    try {
        const pending = JSON.parse(raw) as PendingTransfer
        return typeof pending?.settleBy === 'number' && typeof pending.userId === 'string' ? pending : null
    } catch {
        return null
    }
}
