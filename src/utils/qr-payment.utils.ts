import { formatNumberForDisplay } from './general.utils'
import { EQrType } from '@/components/Global/DirectSendQR/utils'

/**
 * Calculate savings amount (5% of transaction value) in cents
 * @param usdAmount Transaction amount in USD
 * @returns Savings amount in cents, or 0 if invalid
 */
export function calculateSavingsInCents(usdAmount: string | null | undefined): number {
    if (!usdAmount) return 0
    const savingsAmount = parseFloat(usdAmount) * 0.05
    return Math.round(savingsAmount * 100)
}

/**
 * Check if QR payment is for Argentina (Manteca only)
 * @param qrType QR code type from URL parameter
 * @param paymentProcessor Payment processor ('MANTECA' | 'SIMPLEFI')
 * @returns true if this is a Manteca QR payment in Argentina
 */
export function isArgentinaMantecaQrPayment(
    qrType: string | null,
    paymentProcessor: 'MANTECA' | 'SIMPLEFI' | null
): boolean {
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
        return `If you had paid with card, it'd have cost you ~${savingsInCents} ${centsText} more!`
    }

    // If savings is $1 or more, show in dollars
    const formattedDollars = formatNumberForDisplay(savingsInDollars.toString(), { maxDecimals: 2 })
    return `If you had paid with card, it'd have cost you ~$${formattedDollars} more!`
}
