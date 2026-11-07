import { toApiDecimal } from '@/features/avenia/avenia.utils'
import type { PixQuote } from '@/services/pix'

/** The reais to quote: the amount on screen once it reaches the minimum, else the minimum. */
export function pixQuoteAmountBrl(typedBrl: string | undefined, minimumBrl: number): string {
    const typed = toApiDecimal(typedBrl ?? '', 2)
    return typed && Number(typed) >= minimumBrl ? typed : String(minimumBrl)
}

/** BRL per USD of one quote, flat fee included: what the reais buy (deposit) or what the USD pays out (withdraw). */
export function pixQuotePrice(quote: Pick<PixQuote, 'amountBrl' | 'usdcAmount'>): number | null {
    const brl = Number(quote.amountBrl)
    const usd = Number(quote.usdcAmount)
    return brl > 0 && usd > 0 ? brl / usd : null
}
