import type { OfframpQuote, OfframpQuoteAmount } from '@/services/services.types'

/**
 * The bank currencies a withdrawal is quoted in (TASK-23054): the Bridge
 * payouts that convert from USDC. Mirrors QUOTE_CURRENCIES in peanut-api-ts
 * src/bridge/offramp-quote.ts; the quote refuses any other. USD is exempt: it
 * pays 1:1.
 */
export const OFFRAMP_QUOTE_CURRENCIES: readonly string[] = ['eur', 'gbp', 'mxn', 'cop']

/** The amount syntax the quote accepts: 2 decimals, not zero. Mirrors the API's DESTINATION_AMOUNT_PATTERN. */
export const QUOTE_AMOUNT_PATTERN = /^(?=.*[1-9])\d{1,12}(\.\d{1,2})?$/

/**
 * How long the app confirms a quote after it arrived. A quote with an amount
 * does not refresh while it is on the review, so an older one is replaced on
 * submit and the user confirms the new numbers. Measured from when the app
 * received the quote, not from the rate's `updatedAt`: a phone clock that runs
 * fast would otherwise age every quote on arrival.
 */
const QUOTE_MAX_AGE_MS = 60_000

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

/** Whether a quote received at `receivedAt` (ms) is still recent enough to confirm. */
export function isQuoteRecent(receivedAt: number, now: number = Date.now()): boolean {
    return now - receivedAt <= QUOTE_MAX_AGE_MS
}
