/**
 * Build the `/request` prefill URL for the "Split this bill" CTA (shown on QR
 * payments and card spends). The request screen reads `amount` + `merchant`
 * from the query to seed a bill-split request.
 *
 * Two rules baked in (both had real bugs):
 *  - Omit `merchant` for the "Card payment" fallback (a card spend with no
 *    merchant name) so the request comment isn't "Bill split for Card payment".
 *  - URL-encode the merchant so reserved chars (e.g. "Tigers & Lions") can't
 *    break the query string.
 */
export function buildSplitBillRequestUrl(amount: number | bigint | string, merchantName?: string | null): string {
    const merchantParam =
        merchantName && merchantName !== 'Card payment' ? `&merchant=${encodeURIComponent(merchantName)}` : ''
    return `/request?amount=${amount}${merchantParam}`
}
