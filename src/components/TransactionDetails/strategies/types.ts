// Per-kind strategy contract for transactionTransformer's pre-globals
// switch. Each strategy decides direction + card type + counterparty
// name + a few flags from the row's shape; the post-strategy code in
// mapTransactionDataForDrawer handles status mapping, reaper override,
// derived fields (explorer URL, token logos, initials).
//
// Strategies are pure functions of HistoryEntry — no DOM, no fetches,
// no mutable state. Tests import them directly.

import {
    type TransactionDirection,
    type TransactionType as TransactionCardType,
} from '@/components/TransactionDetails/transaction-types'
import { type TransactionNameKey } from '@/components/TransactionDetails/transaction-name-keys'
import { type StatusPillType } from '@/components/Global/StatusPill'
import { type HistoryEntry } from '@/hooks/useTransactionHistory'

export interface TransactionStrategyOutput {
    direction: TransactionDirection
    transactionCardType: TransactionCardType
    nameForDetails: string
    /**
     * Set when `nameForDetails` is an FE-generated label ('Card payment',
     * 'Bank Account', …) rather than counterparty data. Render sites localize
     * via `t(nameKey, nameParams)` and keep `nameForDetails` as the fallback.
     * Dynamic parts (merchant/user names) travel in `nameParams`, not copy.
     */
    nameKey?: TransactionNameKey
    nameParams?: Record<string, string>
    isPeerActuallyUser: boolean
    isLinkTx: boolean
    fullName?: string
    showFullName?: boolean
    /** Optional override; most strategies leave status mapping to the global mapper. */
    uiStatus?: StatusPillType
}

export type TransactionStrategy = (entry: HistoryEntry) => TransactionStrategyOutput
