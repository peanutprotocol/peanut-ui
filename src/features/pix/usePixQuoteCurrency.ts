'use client'

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { SYMBOLS_BY_CURRENCY_CODE } from '@/constants/currency-symbols.consts'
import { useDebounce } from '@/hooks/useDebounce'
import type { useCurrency } from '@/hooks/useCurrency'
import { pixApi, type PixQuoteRequest } from '@/services/pix'
import { pixQuotePrice, pixTypedQuoteBrl } from '@/features/pix/pixQuote.utils'

const TYPING_SETTLE_MS = 400

/** The amount the opening quote prices: a deposit's eligible minimum, or a withdrawal's whole balance. */
export type PixQuoteOpening = Omit<PixQuoteRequest, 'operation'>

/**
 * The BRL price an amount step converts with, from the route provider's
 * indicative quote (GET /pix/quote), in the shape `useCurrency` returns, plus
 * the provider's minimum from that quote. The opening quote prices `opening`
 * and names the minimum; once the reais on screen reach it, they are quoted
 * instead, so the estimate is the quote's own number for that amount, the
 * same one the review shows. `enabled`: the amount step is on screen; no other
 * step needs a quote, and one on a route that is not ready is refused.
 */
export function usePixQuoteCurrency(
    operation: 'deposit' | 'withdraw',
    typedBrl: string | undefined,
    opening: PixQuoteOpening | null,
    enabled: boolean
): ReturnType<typeof useCurrency> & { minimumBrl: string | null } {
    const openingQuote = useQuery({
        queryKey: ['pix-quote', operation, opening],
        queryFn: () => pixApi.quote({ operation, ...opening }),
        enabled: enabled && !!opening,
        staleTime: 30_000,
        retry: false,
    })
    const minimumBrl = openingQuote.data?.minAmountBrl ?? null
    const amountBrl = pixTypedQuoteBrl(useDebounce(typedBrl, TYPING_SETTLE_MS), minimumBrl)
    const typedQuote = useQuery({
        queryKey: ['pix-quote', operation, { amountBrl }],
        queryFn: () => pixApi.quote({ operation, amountBrl: amountBrl! }),
        enabled: enabled && !!amountBrl,
        // the next amount keeps the last price on screen until its quote lands
        placeholderData: keepPreviousData,
        staleTime: 30_000,
        retry: false,
    })
    const quote = (amountBrl && typedQuote.data) || openingQuote.data
    const price = quote ? pixQuotePrice(quote) : null
    return {
        code: 'BRL',
        symbol: SYMBOLS_BY_CURRENCY_CODE.BRL,
        price: price ? { buy: price, sell: price } : null,
        // waiting for what to open with (the eligibility read) counts as loading, never as a USD field
        isLoading: enabled && (!opening || openingQuote.isLoading),
        isError: !quote && (openingQuote.isError || typedQuote.isError),
        refetch: () => {
            void openingQuote.refetch()
            if (amountBrl) void typedQuote.refetch()
        },
        minimumBrl,
    }
}
