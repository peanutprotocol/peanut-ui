import { type OfframpQuote, type OfframpQuoteAmount } from '@/services/services.types'

/** The amount syntax the quote accepts: 2 decimals, not zero. Mirrors the API's DESTINATION_AMOUNT_PATTERN. */
const QUOTE_AMOUNT_PATTERN = /^(?=.*[1-9])\d{1,12}(\.\d{1,2})?$/

/**
 * How long the app confirms a `fixed_output` quote after it arrived. Well
 * inside the API's 2-minute quote lifetime; the quote refreshes every 30s
 * while the review is open. Measured from when the app received the quote,
 * not from `expiresAt`: a phone clock that runs fast would otherwise expire
 * every quote on arrival.
 */
const FIXED_OUTPUT_QUOTE_MAX_AGE_MS = 60_000

/** The typed USDC amount the quote can price, or null when it has more than 2 decimals. */
export function quotableSourceAmount(amount: string): string | null {
    return QUOTE_AMOUNT_PATTERN.test(amount) ? amount : null
}

const sameCents = (a: string | undefined, b: string): boolean =>
    a !== undefined && Math.round(Number(a) * 100) === Math.round(Number(b) * 100)

/**
 * Whether a quote answers the request it was fetched for: the same currency,
 * and both amounts with the typed side unchanged. A quote for another amount
 * must never price this one.
 */
export function quoteAnswersRequest(quote: OfframpQuote, currency: string, amount?: OfframpQuoteAmount): boolean {
    if (quote.destinationCurrency?.toLowerCase() !== currency.toLowerCase()) return false
    if (!amount) return true
    if (quote.sourceAmount === undefined || quote.destinationAmount === undefined) return false
    return 'destinationAmount' in amount
        ? sameCents(quote.destinationAmount, amount.destinationAmount)
        : sameCents(quote.sourceAmount, amount.sourceAmount)
}

/**
 * True for a quote whose amounts create takes as they are: Bridge pays out
 * exactly `destinationAmount` for `sourceAmount`. Any other quote is an
 * estimate, and the transfer converts at settlement.
 */
export function isFixedOutputQuote(quote: OfframpQuote): boolean {
    return quote.pricing === 'fixed_output' && !!quote.quoteId
}

/** Whether a `fixed_output` quote received at `receivedAt` (ms) is still recent enough to confirm. */
export function isFixedOutputQuoteRecent(receivedAt: number, now: number = Date.now()): boolean {
    return now - receivedAt <= FIXED_OUTPUT_QUOTE_MAX_AGE_MS
}

/**
 * Create refused the quote (BRIDGE_QUOTE_INVALID, _EXPIRED, _MISMATCH, _STALE
 * or _USED) before it made a transfer for this request, so nothing was sent.
 */
export function isBridgeQuoteRefusal(code: string | undefined): boolean {
    return !!code?.startsWith('BRIDGE_QUOTE_')
}
