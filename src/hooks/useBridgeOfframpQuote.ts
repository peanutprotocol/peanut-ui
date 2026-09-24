import { getOfframpQuote } from '@/app/actions/offramp'
import { type OfframpQuoteAmount } from '@/services/services.types'
import { quoteAnswersRequest } from '@/utils/offramp-quote.utils'
import { useQuery } from '@tanstack/react-query'
import { useCallback, useState } from 'react'

/** Bridge updates its rates about every 30 seconds; the quote follows. */
const QUOTE_REFRESH_MS = 30_000

/**
 * The quote for a withdrawal to a bank paid in EUR, GBP, MXN or COP
 * (TASK-23054): the USDC a typed bank amount costs, or the bank amount typed
 * USDC buys. Without `amount` it returns only the rate, for the amount step.
 * No fallback rate: a failed quote is an error the screen must show, never a
 * guessed amount.
 *
 * A signed (`fixed_output`) quote does not refresh on its own: the numbers
 * the user confirms are the ones on screen. It is replaced only through
 * `discard`, and the screen then asks the user to review the new numbers.
 * The rate and Bridge-rate estimates keep following Bridge's rate.
 */
export function useBridgeOfframpQuote({
    currency,
    amount,
    enabled = true,
}: {
    /** Lowercase bank currency (eur, gbp, mxn, cop); null for a USD amount. */
    currency: string | null
    amount?: OfframpQuoteAmount
    enabled?: boolean
}) {
    // A quote create refused, or the app will not confirm any more. It stays
    // hidden until a new quote replaces it.
    const [discardedQuoteId, setDiscardedQuoteId] = useState<string | null>(null)
    const { data, dataUpdatedAt, isFetching, isError, refetch } = useQuery({
        queryKey: ['bridgeOfframpQuote', currency, amount ?? null],
        queryFn: async () => {
            const { data, error } = await getOfframpQuote(currency!, amount)
            if (!data) throw new Error(error ?? 'No offramp quote')
            if (!quoteAnswersRequest(data, currency!, amount))
                throw new Error('The offramp quote is for another amount')
            return data
        },
        enabled: enabled && !!currency,
        refetchInterval: (query) => (query.state.data?.quoteId ? false : QUOTE_REFRESH_MS),
        refetchOnWindowFocus: (query) => !query.state.data?.quoteId,
        refetchOnReconnect: (query) => !query.state.data?.quoteId,
        retry: 2,
    })

    /** Drop this quote and get a new one. The screen shows no amounts until it lands. */
    const discard = useCallback(
        (quoteId: string) => {
            setDiscardedQuoteId(quoteId)
            void refetch()
        },
        [refetch]
    )

    // a failed refresh must not leave the last amount confirmable: the screen
    // falls back to its retry state until a fresh quote lands
    const isDiscarded = !!data?.quoteId && data.quoteId === discardedQuoteId
    return {
        quote: isError || isDiscarded ? null : (data ?? null),
        /** When the shown quote arrived (ms). */
        receivedAt: dataUpdatedAt,
        isFetching,
        isError,
        refetch,
        discard,
    }
}
