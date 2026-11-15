// ONRAMP — user wires fiat in, receives USDC. Bridge, Manteca or Avenia.
// Renders as a bank_deposit row regardless of provider; the receipt
// drawer's `mantecaDepositInfo` row gates on `provider === 'MANTECA'`
// for the ARS/BRL deposit-info widget.

import { type TransactionStrategy, type TransactionStrategyOutput } from '../types'
import { TRANSACTION_NAME_KEYS } from '@/components/TransactionDetails/transaction-name-keys'
import { isPixEntry } from '@/components/TransactionDetails/pix-entry'

export const fiatOnramp: TransactionStrategy = (entry): TransactionStrategyOutput => {
    const expired = entry.extraData?.provider === 'MANTECA' && entry.extraData.mantecaDepositExpired === true
    // A deposit is named by its method, whatever the provider (Aleks, 2026-11-15): "Added by Pix".
    const pix = isPixEntry(entry)
    return {
        direction: 'bank_deposit',
        transactionCardType: 'bank_deposit',
        nameForDetails: expired ? 'Deposit order expired' : pix ? 'Pix' : 'Bank Account',
        nameKey: expired
            ? TRANSACTION_NAME_KEYS.depositOrderExpired
            : pix
              ? TRANSACTION_NAME_KEYS.pix
              : TRANSACTION_NAME_KEYS.bankAccount,
        isPeerActuallyUser: false,
        isLinkTx: false,
    }
}
