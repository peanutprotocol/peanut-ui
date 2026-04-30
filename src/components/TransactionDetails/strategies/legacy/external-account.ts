// Strategies for entries that withdraw to / deposit from external (non-user)
// destinations: bank accounts, raw wallet addresses, merchant accounts.

import { type HistoryEntry } from '@/hooks/useTransactionHistory'
import { type TransactionStrategy, type TransactionStrategyOutput } from '../types'

const noPeer = (
    direction: TransactionStrategyOutput['direction'],
    transactionCardType: TransactionStrategyOutput['transactionCardType'],
    nameForDetails: string
): TransactionStrategyOutput => ({
    direction,
    transactionCardType,
    nameForDetails,
    isPeerActuallyUser: false,
    isLinkTx: false,
})

export const withdraw: TransactionStrategy = (entry: HistoryEntry) =>
    noPeer('withdraw', 'withdraw', entry.recipientAccount?.identifier || 'External Account')

export const cashout: TransactionStrategy = (entry: HistoryEntry) =>
    noPeer('withdraw', 'withdraw', entry.recipientAccount?.identifier || 'Bank Account')

export const bankOfframp: TransactionStrategy = () => noPeer('bank_withdraw', 'bank_withdraw', 'Bank Account')

export const bankOnramp: TransactionStrategy = () => noPeer('bank_deposit', 'bank_deposit', 'Bank Account')

export const mantecaQrPayment: TransactionStrategy = (entry: HistoryEntry) =>
    noPeer('qr_payment', 'pay', entry.recipientAccount?.identifier || 'Merchant')

export const simplefiQrPayment: TransactionStrategy = (entry: HistoryEntry) => {
    // No merchant name — prettify the slug: dashes → spaces, title-case.
    const raw = entry.recipientAccount?.identifier || 'Merchant'
    const nameForDetails = raw.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    return noPeer('qr_payment', 'pay', nameForDetails)
}

export const perkReward: TransactionStrategy = () => ({
    direction: 'receive',
    transactionCardType: 'receive',
    nameForDetails: 'Peanut Reward',
    fullName: 'Peanut Rewards',
    isPeerActuallyUser: false,
    isLinkTx: false,
})

export const deposit: TransactionStrategy = (entry: HistoryEntry) => {
    const isTestTransaction = String(entry.amount) === '0' || entry.extraData?.usdAmount === '0'
    return noPeer(
        'add',
        'add',
        isTestTransaction ? 'Enjoy Peanut!' : entry.senderAccount?.identifier || 'Deposit Source'
    )
}
