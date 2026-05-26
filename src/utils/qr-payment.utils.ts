import { formatNumberForDisplay } from './general.utils'
import { EQrType } from '@/components/Global/DirectSendQR/utils'
import { CARD_FX_MARKUP_BY_CURRENCY } from '@/constants/payment.consts'

/**
 * Calculate savings in cents vs paying with a foreign card, given a markup
 * rate (the fraction of the USD transaction value that a card user would
 * lose). Caller is responsible for sourcing the markup — typically from
 * `useCardMarkupRate`, which fetches live for ARS and falls back to a static
 * constant for BRL.
 */
export function calculateSavingsInCents(
    usdAmount: string | null | undefined,
    markupRate: number | null | undefined
): number {
    if (!usdAmount || !markupRate || markupRate <= 0) return 0
    const savingsAmount = parseFloat(usdAmount) * markupRate
    return Math.round(savingsAmount * 100)
}

/**
 * Whether a "vs card" comparison is meaningful for this currency. Only true
 * for currencies with a real card-vs-local-rail gap (ARS, BRL today). Gates
 * rendering of the comparison row before the live markup has resolved.
 */
export function hasCardMarkupComparison(currencyCode: string | null | undefined): boolean {
    if (!currencyCode) return false
    return CARD_FX_MARKUP_BY_CURRENCY[currencyCode.toUpperCase()] !== undefined
}

/**
 * Check if QR payment is for Argentina (Manteca only)
 * @param qrType QR code type from URL parameter
 * @param paymentProcessor Payment processor ('MANTECA' | null)
 * @returns true if this is a Manteca QR payment in Argentina
 */
export function isArgentinaMantecaQrPayment(qrType: string | null, paymentProcessor: 'MANTECA' | null): boolean {
    if (paymentProcessor !== 'MANTECA') return false
    return qrType === EQrType.MERCADO_PAGO || qrType === EQrType.ARGENTINA_QR3
}

/**
 * Get savings message text with proper formatting
 * Shows dollars for amounts >= $1, cents for amounts < $1
 * @param savingsInCents Savings amount in cents
 * @returns Formatted message string
 */
export function getSavingsMessage(savingsInCents: number): string {
    if (savingsInCents <= 0) return ''

    const savingsInDollars = savingsInCents / 100

    // If savings is less than $1, show in cents
    if (savingsInDollars < 1) {
        const centsText = savingsInCents === 1 ? 'cent' : 'cents'
        return `saved ~${savingsInCents} ${centsText} compared to card!`
    }

    // If savings is $1 or more, show in dollars
    const formattedDollars = formatNumberForDisplay(savingsInDollars.toString(), { maxDecimals: 2 })
    return `saved ~$${formattedDollars} compared to card!`
}
