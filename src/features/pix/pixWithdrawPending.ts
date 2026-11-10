import type { PixWithdrawDisplay } from '@/services/pix'
import { readStoredValue, removeStoredValue, writeStoredValue } from '@/utils/safe-storage'

/**
 * A `transfer-then-submit` withdrawal whose submit may have gone out. It has no intent id until the
 * API answers, so the device mark (`pixWithdrawSent`) cannot hold it: this one does. It is written
 * before the submit leaves and kept until the API refuses that submit, the answer names the
 * withdrawal, or the lock's window plus a margin has passed. While any stands, the withdraw page
 * shows the newest as not confirmed yet, never a new Confirm: a reload after a lost answer could
 * otherwise send a second payout.
 *
 * Nothing in history names the price lock or the submit, so a mark is never matched against a row
 * by its amount or time: it stands until its deadline. The marks of one account live under that
 * account's own key, one per price lock: two tabs never overwrite or clear each other's mark, the
 * same account signing back in finds its marks, and another account never reads them.
 */
export interface PendingTransfer {
    priceLockCode: string
    /** What the review showed: the last step's amount and destination. */
    display: PixWithdrawDisplay
    submittedAt: number
    /** After this the API can no longer have taken the submit, and its row would show in history. */
    settleBy: number
}

type PendingTransfers = Record<string, PendingTransfer>

/** The lock bounds the submit; history can lag the API's answer by a little. */
export const PENDING_TRANSFER_MARGIN_MS = 10 * 60_000
const PROBE_KEY = 'pix-withdraw-pending-probe'

/** One account's marks: a map from price lock to mark. */
export const pendingTransfersKey = (userId: string) => `pix-withdraw-pending:${userId}`

/** The marks a stored value holds, every one of them, or none for a value that does not parse. */
export function parsePendingTransfers(raw: string | null): PendingTransfers {
    if (!raw) return {}
    try {
        const parsed = JSON.parse(raw) as unknown
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
        return Object.fromEntries(
            Object.entries(parsed as PendingTransfers).filter(
                ([lock, mark]) => typeof mark?.settleBy === 'number' && mark.priceLockCode === lock
            )
        )
    } catch {
        return {}
    }
}

/** The marks still inside their window, newest first. */
export function standingTransfers(marks: PendingTransfers, now: number): PendingTransfer[] {
    return Object.values(marks)
        .filter((mark) => mark.settleBy > now)
        .sort((a, b) => b.submittedAt - a.submittedAt)
}

function writeMarks(userId: string, marks: PendingTransfers): void {
    if (Object.keys(marks).length) writeStoredValue(pendingTransfersKey(userId), JSON.stringify(marks))
    else removeStoredValue(pendingTransfersKey(userId))
}

/**
 * Adds this lock's mark to the account's marks, dropping only marks past their window, and reads it
 * back: false when this browser could not keep it.
 */
export function markTransferPending(userId: string, mark: PendingTransfer, now = Date.now()): boolean {
    const marks = parsePendingTransfers(readStoredValue(pendingTransfersKey(userId)))
    const standing = Object.fromEntries(standingTransfers(marks, now).map((kept) => [kept.priceLockCode, kept]))
    writeMarks(userId, { ...standing, [mark.priceLockCode]: mark })
    const kept = parsePendingTransfers(readStoredValue(pendingTransfersKey(userId)))[mark.priceLockCode]
    return kept?.submittedAt === mark.submittedAt
}

/** Clears the one mark the answer concerns; the account's other marks stay. */
export function clearTransferPending(userId: string, priceLockCode: string): void {
    const marks = parsePendingTransfers(readStoredValue(pendingTransfersKey(userId)))
    if (!(priceLockCode in marks)) return
    const { [priceLockCode]: _cleared, ...rest } = marks
    writeMarks(userId, rest)
}

/** Drops the account's marks past their window, so no stale record of a key or a holder lingers. */
export function pruneTransferPending(userId: string, now = Date.now()): void {
    const raw = readStoredValue(pendingTransfersKey(userId))
    if (!raw) return
    const marks = parsePendingTransfers(raw)
    const standing = standingTransfers(marks, now)
    if (standing.length === Object.keys(marks).length && Object.keys(marks).length) return
    writeMarks(userId, Object.fromEntries(standing.map((kept) => [kept.priceLockCode, kept])))
}

/** Whether this browser can keep a mark at all (storage blocked, full or private): asked before signing. */
export function canKeepTransferMark(): boolean {
    const value = String(Date.now())
    writeStoredValue(PROBE_KEY, value)
    const kept = readStoredValue(PROBE_KEY) === value
    removeStoredValue(PROBE_KEY)
    return kept
}
