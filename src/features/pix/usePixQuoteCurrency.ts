'use client'

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { SYMBOLS_BY_CURRENCY_CODE } from '@/constants/currency-symbols.consts'
import { useDebounce } from '@/hooks/useDebounce'
import type { useCurrency } from '@/hooks/useCurrency'
import { pixApi } from '@/services/pix'
import { pixQuotePrice, pixQuoteAmountBrl } from '@/features/pix/pixQuote.utils'

const TYPING_SETTLE_MS = 400

/**
 * The BRL price an amount step converts with, from the route provider's
 * indicative quote (GET /pix/quote) for the reais on screen, in the shape
 * `useCurrency` returns. The price is that quote's BRL per USD, flat fee
 * included, so the estimate on screen is the quote's own number for that
 * amount, the same one the review shows. Before an amount is typed, or below
 * the minimum, it prices the minimum.
 */
export function usePixQuoteCurrency(
    operation: 'deposit' | 'withdraw',
    typedBrl: string | undefined,
    minimumBrl: number
): ReturnType<typeof useCurrency> {
    const amountBrl = pixQuoteAmountBrl(useDebounce(typedBrl, TYPING_SETTLE_MS), minimumBrl)
    const quote = useQuery({
        queryKey: ['pix-quote', operation, amountBrl],
        queryFn: () => pixApi.quote({ operation, amountBrl }),
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
        isLoading: quote.isLoading,
        isError: quote.isError && !quote.data,
        refetch: () => void quote.refetch(),
    }
}
