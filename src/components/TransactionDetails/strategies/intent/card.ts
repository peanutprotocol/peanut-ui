import { type HistoryEntry } from '@/hooks/useTransactionHistory'
import { type TransactionStrategy, type TransactionStrategyOutput } from '../types'

/** Rain often returns merchant names ALL-CAPS when its enrichment pipeline
 *  doesn't recognize the brand ("BOYACA", "ANTHROPIC"). When that happens,
 *  display them in Title Case for readability — but only when the name is
 *  long enough that title-casing won't garble a real acronym (KFC, IBM,
 *  BBC stay as-is). Mixed-case names are returned unchanged so enriched
 *  brand names like "iPhone Store" or "Acme Coffee" aren't mangled. */
const ACRONYM_LENGTH_THRESHOLD = 4
function normalizeMerchantName(raw: string): string {
    if (raw !== raw.toUpperCase()) return raw
    if (raw.length <= ACRONYM_LENGTH_THRESHOLD) return raw
    return raw.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
}

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
