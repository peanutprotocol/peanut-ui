import { toApiDecimal } from '@/features/pix/pixFlow.utils'
import type { PixQuote } from '@/services/pix'

/**
 * The reais an amount step quotes: the amount on screen once it reaches the route's minimum
 * (`route.limits`), else the minimum itself, an amount the provider takes. Null with no minimum and
 * no amount yet.
 */
export function pixQuoteAmountBrl(typedBrl: string | undefined, minimumBrl: string | null): string | null {
    const typed = toApiDecimal(typedBrl ?? '', 2)
    if (typed && (minimumBrl === null || Number(typed) >= Number(minimumBrl))) return typed
    return minimumBrl
}

/** Whether an amount on screen is under the route's minimum: the step says so before any quote. */
export function isUnderPixMinimum(typedBrl: string | undefined, minimumBrl: string | null): boolean {
    const typed = Number(typedBrl)
    return minimumBrl !== null && typed > 0 && typed < Number(minimumBrl)
}

/** BRL per USD of one quote, flat fee included: what the reais buy (deposit) or what the USD pays out (withdraw). */
export function pixQuotePrice(quote: Pick<PixQuote, 'amountBrl' | 'usdcAmount'>): number | null {
    const brl = Number(quote.amountBrl)
    const usd = Number(quote.usdcAmount)
    return brl > 0 && usd > 0 ? brl / usd : null
}
