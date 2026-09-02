// Strategies for the ledger-bookkeeping kinds that reach history rarely (or,
// for INTERNAL_TRANSFER, only through the detail route — the list hides the
// kind server-side). They exist so the IntentKind registry stays total over
// the generated wire vocabulary: an unmapped kind used to fall through to
// intentFallback and render as an OUTGOING send with a minus sign — wrong in
// both direction and tone for anything credit-shaped (TASK-21403's shape).

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
 * A chargeback DEBITS the user (the BE's INFLOW_KINDS deliberately excludes
 * CHARGEBACK — funds leave the account when a dispute resolves against it).
 * The kind is enum-reserved with no live writer yet; the shape here keeps a
 * future row honest instead of surprising. A dispute resolving in the
 * USER's favor is the other lane entirely — it arrives as kind=REFUND and
 * renders through cardRefund as the credit the card terms promise
 * (card-terms-international §"Chargebacks resolved in your favor").
 */
export const chargeback: TransactionStrategy = (): TransactionStrategyOutput => ({
    direction: 'send',
    transactionCardType: 'send',
    nameForDetails: 'Chargeback',
    nameKey: TRANSACTION_NAME_KEYS.transaction,
    isPeerActuallyUser: false,
    isLinkTx: false,
})
