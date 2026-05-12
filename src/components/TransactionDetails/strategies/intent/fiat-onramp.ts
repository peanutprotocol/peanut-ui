// ONRAMP — user wires fiat in, receives USDC. Bridge or Manteca.
// Renders as a bank_deposit row regardless of provider; the receipt
// drawer's `mantecaDepositInfo` row gates on `provider === 'MANTECA'`
// for the ARS/BRL deposit-info widget.

import { type HistoryEntry } from '@/hooks/useTransactionHistory'
import { type TransactionStrategy, type TransactionStrategyOutput } from '../types'

export const fiatOnramp: TransactionStrategy = (_entry: HistoryEntry): TransactionStrategyOutput => ({
    direction: 'bank_deposit',
    transactionCardType: 'bank_deposit',
    nameForDetails: 'Bank Account',
    isPeerActuallyUser: false,
    isLinkTx: false,
})
