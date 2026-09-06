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
 * Stable per-scan idempotency key for `/manteca/qr-payment/init`.
 *
 * The init POST creates a real Manteca price lock, and the client retries it on
 * timeout — the one case where the server may well have succeeded. This key is
 * what lets the backend replay that lock instead of minting a second one, so it
 * MUST be identical across every retry of one scan and different across scans.
 *
 * Derived rather than random so it also survives a remount. Every input is
 * HASHED rather than embedded: `qrCode` because a payment destination can
 * encode a Pix key (CPF, email, phone) that has no business becoming a durable
 * cache key, and `timestamp` because it comes straight off an untrusted URL
 * parameter — a long enough `t` would push the composed key past the backend's
 * 200-character bound, where it is dropped, silently restoring the very
 * duplicate-lock behaviour this exists to prevent.
 *
 * `amount` is part of the identity: an open-amount QR re-inits with the user's
 * number, and a different amount is a genuinely different lock.
 */
export function qrInitIdempotencyKey(input: { qrCode: string; timestamp: string | null; amount?: string }): string {
    const canonical = [input.timestamp ?? '', input.qrCode, input.amount ?? ''].join('\u0000')
    // Two independently seeded 64-bit halves; the separator is a byte that
    // cannot appear in any of the fields, so adjacent values can never blur.
    return `${fnv1a64(canonical)}${fnv1a64(`${canonical.length}\u0000${canonical}`)}`
}

/** FNV-1a over 64 bits, as two 32-bit halves with different offsets. */
function fnv1a64(value: string): string {
    let h1 = 0x811c9dc5
    let h2 = 0x01000193
    for (let i = 0; i < value.length; i++) {
        const c = value.charCodeAt(i)
        h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0
        h2 = Math.imul(h2 ^ c, 0x811c9dc5) >>> 0
    }
    return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0')
}
