import { API_ERROR_CODES } from '@/services/api-error'
import { TransactionIntentStatus } from '@/constants/api-enums.generated'
import type { SendOrderRead } from '@/features/payments/shared/utils/pending-charge-send'

/** What `/users/history` returns for a Manteca offramp row. */
export interface MantecaHistoryRow {
    status?: string
    /** USD, as the withdrawal debited it; '0' when the ledger has no leg yet. */
    amount?: string
    currency?: { amount?: string; code?: string }
    recipientAccount?: { identifier?: string; type?: string }
    extraData?: { provider?: string; kind?: string; isRefund?: boolean }
}

/** What the booked withdrawal says it paid, and to whom. A recovered success has no quote, so it shows these. */
export type BookedMantecaWithdrawal = Pick<MantecaHistoryRow, 'amount' | 'currency' | 'recipientAccount'>

export type MantecaReadDestination = { kind: 'loading' } | { kind: 'resolved'; destination: string | null }

/**
 * Resolve the destination identifier used to correlate a held Manteca
 * withdrawal against `/users/history`.
 *
 * - Saved-account hold while `user.accounts` is still hydrating → `'loading'`
 *   so recovery waits (`settling`) instead of degrading `destination` to `null`.
 * - Saved-account hold once loaded → matched account's lowercased identifier
 *   (or `null` if the saved account was deleted).
 * - Unsaved (`new`) hold → `null`.
 */
export function resolveMantecaReadDestination(input: {
    heldAccountId: string | null
    accountsLoaded: boolean
    accounts: ReadonlyArray<{ id: string; identifier: string }> | undefined
}): MantecaReadDestination {
    if (input.heldAccountId && !input.accountsLoaded) return { kind: 'loading' }
    if (!input.heldAccountId) return { kind: 'resolved', destination: null }
    const identifier =
        input.accounts?.find((account) => account.id === input.heldAccountId)?.identifier.toLowerCase() ?? null
    return { kind: 'resolved', destination: identifier }
}

const CLOSED_MANTECA_STATUSES: ReadonlySet<string> = new Set([
    TransactionIntentStatus.FAILED,
    TransactionIntentStatus.CANCELLED,
    TransactionIntentStatus.REFUNDED,
])

/**
 * Pure classification of `/users/history` rows for Manteca withdrawal recovery.
 *
 * When `destination` is `null` (an unsaved destination or a deleted saved
 * account), we cannot distinguish this device's lost-answer send from a
 * withdrawal made on another device — stay `settling` so another device's
 * completed withdrawal never clears this guard or renders as this send's
 * success (chain `ReadUserOps` / Rain preparation status still prove
 * `not-sent` when nothing moved).
 */
export function classifyMantecaHistoryEntries(
    entries: readonly MantecaHistoryRow[],
    destination: string | null,
    showBooked: (booked: BookedMantecaWithdrawal) => void
): SendOrderRead {
    if (destination === null) return { state: 'settling' }
    const withdrawals = entries.filter(
        (row) =>
            row.extraData?.provider === 'MANTECA' &&
            row.extraData.kind === 'OFFRAMP' &&
            !row.extraData.isRefund &&
            row.recipientAccount?.identifier?.toLowerCase() === destination
    )
    if (withdrawals.length !== 1) return { state: 'settling' }
    const { status, amount, currency, recipientAccount } = withdrawals[0]
    if (status === TransactionIntentStatus.COMPLETED) {
        return { state: 'completed', show: () => showBooked({ amount, currency, recipientAccount }) }
    }
    return status !== undefined && CLOSED_MANTECA_STATUSES.has(status) ? { state: 'closed' } : { state: 'settling' }
}

/**
 * Whether a Manteca withdraw response represents an ambiguous outcome where the
 * signed UserOp / funding leg may have moved on-chain and recovery must take
 * over instead of clearing the pay guard.
 */
export function isAmbiguousMantecaSubmitResult(result: { error?: string; code?: string }): boolean {
    return (
        result.error === 'Unexpected error' ||
        result.code === API_ERROR_CODES.FUNDING_PENDING_CONFIRMATION ||
        result.code === 'USER_OP_RECEIPT_TIMEOUT'
    )
}
