// Strategies for the ledger-bookkeeping kinds that reach history rarely (or,
// for INTERNAL_TRANSFER, only through the detail route — the list hides the
// kind server-side). They exist so the IntentKind registry stays total over
// the generated wire vocabulary: an unmapped kind used to fall through to
// intentFallback and render as an OUTGOING send with a minus sign — wrong in
// both direction and tone for anything credit-shaped (TASK-21403's shape).

import { EHistoryUserRole, type HistoryEntry } from '@/hooks/useTransactionHistory'
import { type TransactionStrategy, type TransactionStrategyOutput } from '../types'
import { TRANSACTION_NAME_KEYS } from '@/components/TransactionDetails/transaction-name-keys'

/**
 * Collateral sweeps, auto-rebalances, admin moves — the user's own money
 * moving between the user's own ledgers. Neutral outgoing shape, no alert:
 * the kind is known, just not customer-meaningful.
 */
export const internalTransfer: TransactionStrategy = (): TransactionStrategyOutput => ({
    direction: 'send',
    transactionCardType: 'send',
    nameForDetails: 'Internal transfer',
    nameKey: TRANSACTION_NAME_KEYS.transaction,
    isPeerActuallyUser: false,
    isLinkTx: false,
})

/**
 * Chargeback direction follows the VIEWER'S ledger entry, not a fixed sign:
 * the mapper derives userRole from the viewer's PRINCIPAL entry, and the
 * ledger contract lets a CHARGEBACK debit or credit either side. The common
 * case is a debit (the BE's INFLOW_KINDS deliberately excludes CHARGEBACK),
 * so SENDER/BOTH/NONE render outgoing; a viewer whose entry is the CREDIT
 * side arrives as RECIPIENT and renders incoming. The kind is enum-reserved
 * with no live writer yet; a dispute resolving in the USER's favor is the
 * other lane entirely — it arrives as kind=REFUND and renders through
 * cardRefund as the credit the card terms promise
 * (card-terms-international §"Chargebacks resolved in your favor").
 */
export const chargeback: TransactionStrategy = (entry: HistoryEntry): TransactionStrategyOutput => {
    const incoming = entry.userRole === EHistoryUserRole.RECIPIENT
    return {
        direction: incoming ? 'receive' : 'send',
        transactionCardType: incoming ? 'receive' : 'send',
        nameForDetails: 'Chargeback',
        nameKey: TRANSACTION_NAME_KEYS.transaction,
        isPeerActuallyUser: false,
        isLinkTx: false,
    }
}
