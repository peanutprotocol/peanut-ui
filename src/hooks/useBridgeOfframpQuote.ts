import { getOfframpQuote } from '@/app/actions/offramp'
import { type OfframpQuoteAmount } from '@/services/services.types'
import { quoteAnswersRequest } from '@/utils/offramp-quote.utils'
import { useQuery } from '@tanstack/react-query'
import { useCallback, useState } from 'react'

/** Bridge updates its rates about every 30 seconds; the rate follows. */
const QUOTE_REFRESH_MS = 30_000

/**
 * The quote for a withdrawal to a bank paid in EUR, GBP, MXN or COP
 * (TASK-23054): the USDC a typed bank amount costs, or the estimated bank
 * amount typed USDC buys. Without `amount` it returns only the rate, for the
 * amount step, and keeps following Bridge's rate. No fallback rate: a failed
 * quote is an error the screen must show, never a guessed amount.
 *
 * A quote with an amount does not change on its own: the numbers the user
 * confirms are the ones on screen. Only `requote` replaces it, and the screen
 * then asks the user to review the new numbers.
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
    // When the quote the app will not confirm any more arrived. It stays
    // hidden until a new quote replaces it.
    const [requotedAt, setRequotedAt] = useState<number | null>(null)
    const holdsStill = !!amount
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
        // never stale: re-enabling the query (after a failed submit) must not swap the numbers either
        staleTime: holdsStill ? Infinity : 0,
        refetchInterval: holdsStill ? false : QUOTE_REFRESH_MS,
        refetchOnWindowFocus: !holdsStill,
        refetchOnReconnect: !holdsStill,
        retry: 2,
    })

    /** Drop this quote and get a new one. The screen shows no amounts until it lands. */
    const requote = useCallback(() => {
        setRequotedAt(dataUpdatedAt)
        void refetch()
    }, [dataUpdatedAt, refetch])

    // A failed refresh keeps the last quote on screen, so the screen and any open
    // KYC or terms step stay mounted; `isError` says it is no longer current, and
    // a caller must not confirm it until a fresh quote lands. A replaced quote
    // is never shown again, whatever the refetch answers.
    const isReplaced = requotedAt !== null && dataUpdatedAt === requotedAt
    return {
        quote: isReplaced ? null : (data ?? null),
        /** When the shown quote arrived (ms). */
        receivedAt: dataUpdatedAt,
        isFetching,
        isError,
        refetch,
        requote,
    }
}
