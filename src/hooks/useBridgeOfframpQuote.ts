import { getOfframpQuote } from '@/app/actions/offramp'
import { useQuery } from '@tanstack/react-query'

/** Bridge updates its rates about every 30 seconds; the quote follows. */
const QUOTE_REFRESH_MS = 30_000

/**
 * The USDC a withdrawal of an exact bank amount costs now (TASK-23054).
 * Without `destinationAmount` it returns only the rate, for the amount step.
 * No fallback rate: a failed quote is an error the screen must show, never a
 * guessed amount.
 */
export function useBridgeOfframpQuote({
    currency,
    destinationAmount,
    enabled = true,
}: {
    /** Lowercase destination currency (eur, gbp, mxn); null outside exact mode. */
    currency: string | null
    destinationAmount?: string
    enabled?: boolean
}) {
    const { data, isFetching, isError, refetch } = useQuery({
        queryKey: ['bridgeOfframpQuote', currency, destinationAmount ?? null],
        queryFn: async () => {
            const { data, error } = await getOfframpQuote(currency!, destinationAmount)
            if (!data) throw new Error(error ?? 'No offramp quote')
            return data
        },
        enabled: enabled && !!currency,
        refetchInterval: QUOTE_REFRESH_MS,
        retry: 2,
    })
    return { quote: data ?? null, isFetching, isError, refetch }
}
