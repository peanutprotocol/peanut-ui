import { toApiDecimal } from '@/features/pix/pixFlow.utils'
import type { PixQuote } from '@/services/pix'

/**
 * The reais on screen, as the quote takes them, once they reach the provider's minimum (the quote's
 * `minAmountBrl`). Null below it, or before the first quote has said what it is.
 */
export function pixTypedQuoteBrl(typedBrl: string | undefined, minimumBrl: string | null): string | null {
    const typed = toApiDecimal(typedBrl ?? '', 2)
    return typed && minimumBrl !== null && Number(typed) >= Number(minimumBrl) ? typed : null
}

/** BRL per USD of one quote, flat fee included: what the reais buy (deposit) or what the USD pays out (withdraw). */
export function pixQuotePrice(quote: Pick<PixQuote, 'amountBrl' | 'usdcAmount'>): number | null {
    const brl = Number(quote.amountBrl)
    const usd = Number(quote.usdcAmount)
    return brl > 0 && usd > 0 ? brl / usd : null
}
