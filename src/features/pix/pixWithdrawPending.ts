import type { PixWithdrawDisplay } from '@/services/pix'
import { readStoredValue, removeStoredValue, storedKeysWithPrefix, writeStoredValue } from '@/utils/safe-storage'

/**
 * A `transfer-then-submit` withdrawal whose submit may have gone out. It has no intent id until the
 * API answers, so the device mark (`pixWithdrawSent`) cannot hold it: this one does. It is written
 * before the submit leaves and kept until the API refuses that submit, the answer names the
 * withdrawal, or the lock's window plus a margin has passed. While any stands, the withdraw page
 * shows the newest as not confirmed yet, never a new Confirm: a reload after a lost answer could
 * otherwise send a second payout.
 *
 * Nothing in history names the price lock or the submit, so a mark is never matched against a row
 * by its amount or time: it stands until its deadline. Each mark has its own storage key, per
 * account and price lock (`pix-withdraw-pending:<user id>:<lock code>`), written and removed on
 * its own: two tabs never rewrite a shared value, so neither can drop the other's mark; the same
 * account signing back in finds its marks; another account never reads them.
 */
export interface PendingTransfer {
    priceLockCode: string
    /** What the review showed: the last step's amount and destination. */
    display: PixWithdrawDisplay
    submittedAt: number
    /** After this the API can no longer have taken the submit, and its row would show in history. */
    settleBy: number
}

/** The lock bounds the submit; history can lag the API's answer by a little. */
export const PENDING_TRANSFER_MARGIN_MS = 10 * 60_000
const KEY_ROOT = 'pix-withdraw-pending'
const PROBE_KEY = `${KEY_ROOT}-probe`

/** The prefix of one account's mark keys. */
export const pendingTransfersPrefix = (userId: string) => `${KEY_ROOT}:${userId}:`
export const pendingTransferKey = (userId: string, priceLockCode: string) =>
    `${pendingTransfersPrefix(userId)}${priceLockCode}`

/** One stored mark, or null for a value that does not parse or names another lock than its key. */
export function parsePendingTransfer(raw: string | null, priceLockCode: string): PendingTransfer | null {
    if (!raw) return null
    try {
        const mark = JSON.parse(raw) as PendingTransfer
        return typeof mark?.settleBy === 'number' && mark.priceLockCode === priceLockCode ? mark : null
    } catch {
        return null
    }
}

/** Every mark the account has stored, ordered by lock code; unreadable ones are left out. */
export function readTransfersPending(userId: string): PendingTransfer[] {
    const prefix = pendingTransfersPrefix(userId)
    return storedKeysWithPrefix(prefix)
        .sort()
        .flatMap((key) => {
            const mark = parsePendingTransfer(readStoredValue(key), key.slice(prefix.length))
            return mark ? [mark] : []
        })
}

/** The marks still inside their window, newest first. */
export function standingTransfers(marks: readonly PendingTransfer[], now: number): PendingTransfer[] {
    return marks.filter((mark) => mark.settleBy > now).sort((a, b) => b.submittedAt - a.submittedAt)
}

/** Writes this lock's own key and reads it back: false when this browser could not keep it. */
export function markTransferPending(userId: string, mark: PendingTransfer): boolean {
    const key = pendingTransferKey(userId, mark.priceLockCode)
    const value = JSON.stringify(mark)
    writeStoredValue(key, value)
    return readStoredValue(key) === value
}

/** Removes the one mark the answer concerns; the account's other marks are other keys. */
export function clearTransferPending(userId: string, priceLockCode: string): void {
    removeStoredValue(pendingTransferKey(userId, priceLockCode))
}

/**
 * Removes the account's marks past their window or unreadable, and the keys earlier builds of
 * this branch wrote (one unscoped mark, then one map per account), so no stale record of a key or
 * a holder lingers.
 */
export function pruneTransferPending(userId: string, now = Date.now()): void {
    removeStoredValue(KEY_ROOT)
    removeStoredValue(`${KEY_ROOT}:${userId}`)
    const prefix = pendingTransfersPrefix(userId)
    for (const key of storedKeysWithPrefix(prefix)) {
        const mark = parsePendingTransfer(readStoredValue(key), key.slice(prefix.length))
        if (!mark || mark.settleBy <= now) removeStoredValue(key)
    }
}

/** Whether this browser can keep a mark at all (storage blocked, full or private): asked before signing. */
export function canKeepTransferMark(): boolean {
    const value = String(Date.now())
    writeStoredValue(PROBE_KEY, value)
    const kept = readStoredValue(PROBE_KEY) === value
    removeStoredValue(PROBE_KEY)
    return kept
}
