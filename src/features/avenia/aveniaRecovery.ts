/**
 * An Avenia withdrawal whose payout the bank refused: the money waits with
 * Avenia until the user names another Pix key in their own name. Kept apart
 * from avenia.utils so the history transformer can read it without the
 * withdraw helpers.
 */
import type { HistoryEntryExtraData } from '@/utils/history.utils'

/**
 * Whether a withdrawal's history entry says its payout was refused for the
 * key or the account, so the money waits with Avenia for another own key
 * (PR B `NEEDS_NEW_KEY`: `extraData.aveniaRecovery.state` is `awaiting-key`).
 */
export function awaitsNewPixKey(extraData: HistoryEntryExtraData | undefined): boolean {
    return extraData?.aveniaRecovery?.state === 'awaiting-key'
}

/** The new-key screen for a withdrawal (`intentId` in the URL, so a notification can open it). */
export function aveniaNewKeyUrl(intentId: string): string {
    return `/withdraw/new-pix-key?intentId=${encodeURIComponent(intentId)}`
}
