'use client'

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { SYMBOLS_BY_CURRENCY_CODE } from '@/constants/currency-symbols.consts'
import { useDebounce } from '@/hooks/useDebounce'
import type { useCurrency } from '@/hooks/useCurrency'
import { pixApi } from '@/services/pix'
import { pixQuoteAmountBrl, pixQuotePrice } from '@/features/pix/pixQuote.utils'

const TYPING_SETTLE_MS = 400

/**
 * The BRL price an amount step converts with, from the route provider's
 * indicative quote (GET /pix/quote), in the shape `useCurrency` returns. The
 * reais on screen are quoted once they reach the route's minimum
 * (`route.limits`), so the estimate is the quote's own number for that amount,
 * the same one the review shows; before an amount is typed, or below the
 * minimum, the minimum is quoted, an amount the provider takes. `enabled`: the
 * amount step is on screen; no other step needs a quote, and one on a route
 * that is not ready is refused.
 */
export function usePixQuoteCurrency(
    operation: 'deposit' | 'withdraw',
    typedBrl: string | undefined,
    minimumBrl: string | null,
    enabled: boolean
): ReturnType<typeof useCurrency> {
    const amountBrl = pixQuoteAmountBrl(useDebounce(typedBrl, TYPING_SETTLE_MS), minimumBrl)
    const quote = useQuery({
        queryKey: ['pix-quote', operation, amountBrl],
        queryFn: () => pixApi.quote({ operation, amountBrl: amountBrl! }),
        enabled: enabled && !!amountBrl,
        // the next amount keeps the last price on screen until its quote lands
        placeholderData: keepPreviousData,
        staleTime: 30_000,
        retry: false,
    })
    const price = quote.data ? pixQuotePrice(quote.data) : null
    return {
        code: 'BRL',
        symbol: SYMBOLS_BY_CURRENCY_CODE.BRL,
        price: price ? { buy: price, sell: price } : null,
        isLoading: enabled && quote.isLoading,
        isError: quote.isError && !quote.data,
        refetch: () => void quote.refetch(),
    }
}
