'use client'

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { SYMBOLS_BY_CURRENCY_CODE } from '@/constants/currency-symbols.consts'
import { useDebounce } from '@/hooks/useDebounce'
import type { useCurrency } from '@/hooks/useCurrency'
import { pixApi } from '@/services/pix'
import { toApiDecimal } from '@/features/pix/pixFlow.utils'
import { pixQuoteAmountBrl, pixQuotePrice } from '@/features/pix/pixQuote.utils'
import { pixRateAndFee, type PixRateAndFee } from '@/features/pix/pixRateAndFee'

/** How long after the last keystroke an amount counts as settled: only then is it quoted or kept. */
export const TYPING_SETTLE_MS = 400

/**
 * The BRL price an amount step converts with, from the route provider's
 * indicative quote (GET /pix/quote), in the shape `useCurrency` returns. The
 * reais on screen are quoted once they reach the route's minimum
 * (`route.limits`), so the estimate is the quote's own number for that amount,
 * the same one the review shows; before an amount is typed, or below the
 * minimum, the minimum is quoted, an amount the provider takes. `enabled`: the
 * amount step is on screen; no other step needs a quote, and one on a route
 * that is not ready is refused.
 *
 * `rateAndFee` is the quote's own rate and fee rows (`pixRateAndFee`): undefined until a quote is in
 * hand, null when it sends none. `quotesTypedAmount`: the quote is for the reais on screen, not the
 * minimum, so its fee is the user's.
 */
export function usePixQuoteCurrency(
    operation: 'deposit' | 'withdraw',
    typedBrl: string | undefined,
    minimumBrl: string | null,
    enabled: boolean
): ReturnType<typeof useCurrency> & { rateAndFee: PixRateAndFee | null | undefined; quotesTypedAmount: boolean } {
    const settledBrl = useDebounce(typedBrl, TYPING_SETTLE_MS)
    const amountBrl = pixQuoteAmountBrl(settledBrl, minimumBrl)
    const quote = useQuery({
        queryKey: ['pix-quote', operation, amountBrl],
        queryFn: () => pixApi.quote({ operation, amountBrl: amountBrl! }),
        enabled: enabled && !!amountBrl,
        // the next amount keeps the last price on screen until its quote lands
        placeholderData: keepPreviousData,
        staleTime: 30_000,
        retry: false,
    })
    // the field converts with amount ÷ USDC, every fee in; the rate row is the quote's exchangeRate
    const price = quote.data ? pixQuotePrice(quote.data) : null
    // the amount on screen now, not the debounced one: an older quote's fee is never this amount's
    const typed = toApiDecimal(typedBrl ?? '', 2)
    return {
        rateAndFee: quote.data ? pixRateAndFee(quote.data) : undefined,
        quotesTypedAmount: !!quote.data && !quote.isPlaceholderData && !!typed && amountBrl === typed,
        code: 'BRL',
        symbol: SYMBOLS_BY_CURRENCY_CODE.BRL,
        price: price ? { buy: price, sell: price } : null,
        isLoading: enabled && quote.isLoading,
        isError: quote.isError && !quote.data,
        refetch: () => void quote.refetch(),
    }
}
