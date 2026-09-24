import { offrampRateQueryOptions } from '@/utils/offramp-rate.query'
import { useQuery } from '@tanstack/react-query'

/**
 * The public withdrawal rate for a EUR, GBP, MXN or COP payout: Bridge's rate,
 * with Peanut's FX margin inside while it is collected. Fails closed: an error
 * gives no rate, never the last one.
 */
export function useOfframpRate(destinationCurrency: string, { enabled = true }: { enabled?: boolean } = {}) {
    const { data, isError } = useQuery({ ...offrampRateQueryOptions(destinationCurrency), enabled })
    return { rate: isError ? null : (data?.rate ?? null), isError }
}
