/**
 * A Pix deposit's code, read from one source: GET /pix/deposit/:intentId. Kept apart from
 * pixFlow.utils so the history transformer can read it without the deposit and withdraw helpers.
 */
import type { HistoryEntryExtraData } from '@/utils/history.utils'

/** The one query that holds a deposit and its code; POST /pix/deposit seeds it with the same shape. */
export const pixDepositQueryKey = (intentId: string) => ['pix-deposit', intentId] as const

/**
 * Whether a deposit's history entry says its code can still be paid. The API
 * sends `pixDeposit` to the owner only; the expiry is checked again here
 * because a history entry can be read minutes before it is shown.
 */
export function pixCodePayable(extraData: HistoryEntryExtraData | undefined, nowMs: number): boolean {
    const deposit = extraData?.pixDeposit
    if (!deposit?.codePayable) return false
    return deposit.expiresAt === null || Date.parse(deposit.expiresAt) > nowMs
}
