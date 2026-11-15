// ONRAMP — user wires fiat in, receives USDC. Bridge or Manteca.
// Renders as a bank_deposit row regardless of provider; the receipt
// drawer's `mantecaDepositInfo` row gates on `provider === 'MANTECA'`
// for the ARS/BRL deposit-info widget.

import { type TransactionStrategy, type TransactionStrategyOutput } from '../types'
import { TRANSACTION_NAME_KEYS } from '@/components/TransactionDetails/transaction-name-keys'

export const fiatOnramp: TransactionStrategy = (entry): TransactionStrategyOutput => {
    const expired = entry.extraData?.provider === 'MANTECA' && entry.extraData.mantecaDepositExpired === true
    return {
        direction: 'bank_deposit',
        transactionCardType: 'bank_deposit',
        nameForDetails: expired ? 'Deposit order expired' : 'Bank Account',
        nameKey: expired ? TRANSACTION_NAME_KEYS.depositOrderExpired : TRANSACTION_NAME_KEYS.bankAccount,
        isPeerActuallyUser: false,
        isLinkTx: false,
    }
}
