// Per-kind strategy contract. Each strategy decides direction + card type +
// counterparty name + a few flags from the row's shape;
// `mapTransactionDataForDrawer` handles status mapping, reaper override, and
// derived fields (explorer URL, token logos, initials). Strategies are pure
// functions of HistoryEntry — no IO, no mutable state.

import { type TransactionType as TransactionCardType } from '@/components/TransactionDetails/TransactionCard'
import { type TransactionDirection } from '@/components/TransactionDetails/TransactionDetailsHeaderCard'
import { type StatusPillType } from '@/components/Global/StatusPill'
import { type HistoryEntry } from '@/hooks/useTransactionHistory'

export interface TransactionStrategyOutput {
    direction: TransactionDirection
    transactionCardType: TransactionCardType
    nameForDetails: string
    isPeerActuallyUser: boolean
    isLinkTx: boolean
    fullName?: string
    showFullName?: boolean
    /** Optional override; most strategies leave status mapping to the global mapper. */
    uiStatus?: StatusPillType
}

export type TransactionStrategy = (entry: HistoryEntry) => TransactionStrategyOutput
