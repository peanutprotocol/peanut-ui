import { type HistoryEntry } from '@/hooks/useTransactionHistory'
import { type TransactionStrategy, type TransactionStrategyOutput } from '../types'
import { normalizeMerchantName } from '@/components/TransactionDetails/transaction-details.utils'

export const qrPay: TransactionStrategy = (entry: HistoryEntry): TransactionStrategyOutput => {
    const raw = entry.recipientAccount?.identifier
    return {
        direction: 'qr_payment',
        transactionCardType: 'pay',
        nameForDetails: raw ? normalizeMerchantName(raw) : 'Merchant',
        isPeerActuallyUser: false,
        isLinkTx: false,
    }
}

export const cardSpend: TransactionStrategy = (entry: HistoryEntry): TransactionStrategyOutput => {
    const merchantName = (entry.extraData?.merchantName as string | null | undefined) ?? null
    return {
        direction: 'qr_payment',
        // Rain card-spend gets its own card type so the avatar can render
        // a credit-card icon. 'pay' is reserved for Manteca QR pays which
        // render the Mercado Pago / PIX brand mark instead.
        transactionCardType: 'card_pay',
        nameForDetails: merchantName ? normalizeMerchantName(merchantName) : 'Card payment',
        isPeerActuallyUser: false,
        isLinkTx: false,
    }
}

export const cardRefund: TransactionStrategy = (entry: HistoryEntry): TransactionStrategyOutput => {
    const merchantName = (entry.extraData?.merchantName as string | null | undefined) ?? null
    const cleaned = merchantName ? normalizeMerchantName(merchantName) : null
    return {
        direction: 'receive',
        transactionCardType: 'receive',
        nameForDetails: cleaned ? `Refund from ${cleaned}` : 'Card refund',
        isPeerActuallyUser: false,
        isLinkTx: false,
    }
}
