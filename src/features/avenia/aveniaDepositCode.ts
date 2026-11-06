/**
 * An Avenia Pix deposit's code, read from one source: GET /avenia/deposit/:intentId.
 * Kept apart from avenia.utils so the history transformer can read it without the
 * deposit and withdraw helpers.
 */
import type { AveniaDeposit, AveniaDepositStatus } from '@/services/avenia'
import type { HistoryEntryExtraData } from '@/utils/history.utils'

/** The one query that holds a deposit and its code; POST /avenia/deposit seeds it. */
export const aveniaDepositQueryKey = (intentId: string) => ['avenia-deposit', intentId] as const

/** The deposit read a just-created deposit is, so the code shows without a second request. */
export function depositReadFromCreated(created: AveniaDeposit): AveniaDepositStatus {
    return {
        intentId: created.intentId,
        status: 'AWAITING_USER_ACTION',
        ticketStatus: 'UNPAID',
        expiresAt: created.expiresAt,
        amountBrl: created.amountBrl,
        usdcAmount: created.usdcAmount,
        codePayable: true,
        brCode: created.brCode,
        payerCpfMasked: created.payerCpfMasked,
    }
}

/**
 * Whether a deposit's history entry says its code can still be paid. The API
 * sends `aveniaDeposit` to the owner only; the expiry is checked again here
 * because a history entry can be read minutes before it is shown.
 */
export function aveniaCodePayable(extraData: HistoryEntryExtraData | undefined, nowMs: number): boolean {
    const deposit = extraData?.aveniaDeposit
    if (!deposit?.codePayable) return false
    return deposit.expiresAt === null || Date.parse(deposit.expiresAt) > nowMs
}
