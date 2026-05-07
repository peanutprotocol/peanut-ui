import { type HistoryEntry } from '@/hooks/useTransactionHistory'
import { type TransactionStrategy, type TransactionStrategyOutput } from '../types'

export const qrPay: TransactionStrategy = (entry: HistoryEntry): TransactionStrategyOutput => ({
    direction: 'qr_payment',
    transactionCardType: 'pay',
    nameForDetails: entry.recipientAccount?.identifier || 'Merchant',
    isPeerActuallyUser: false,
    isLinkTx: false,
})

export const cardSpend: TransactionStrategy = (entry: HistoryEntry): TransactionStrategyOutput => {
    const merchantName = (entry.extraData?.merchantName as string | null | undefined) ?? null
    return {
        direction: 'qr_payment',
        // Rain card-spend gets its own card type so the avatar can render
        // a credit-card icon. 'pay' is reserved for Manteca QR pays which
        // render the Mercado Pago / PIX brand mark instead.
        transactionCardType: 'card_pay',
        nameForDetails: merchantName || 'Card payment',
        isPeerActuallyUser: false,
        isLinkTx: false,
    }
}

export const cardRefund: TransactionStrategy = (entry: HistoryEntry): TransactionStrategyOutput => {
    const merchantName = (entry.extraData?.merchantName as string | null | undefined) ?? null
    return {
        direction: 'receive',
        transactionCardType: 'receive',
        nameForDetails: merchantName ? `Refund from ${merchantName}` : 'Card refund',
        isPeerActuallyUser: false,
        isLinkTx: false,
    }
}
