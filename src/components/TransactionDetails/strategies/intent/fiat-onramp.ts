// ONRAMP — user wires fiat in, receives USDC. Bridge or Manteca.
// Renders as a bank_deposit row regardless of provider; the receipt
// drawer's `mantecaDepositInfo` row gates on `provider === 'MANTECA'`
// for the ARS/BRL deposit-info widget.

import { type TransactionStrategy, type TransactionStrategyOutput } from '../types'

// No per-entry branching — onramp output is fully derivable from the kind.
export const fiatOnramp: TransactionStrategy = (): TransactionStrategyOutput => ({
    direction: 'bank_deposit',
    transactionCardType: 'bank_deposit',
    nameForDetails: 'Bank Account',
    isPeerActuallyUser: false,
    isLinkTx: false,
})
