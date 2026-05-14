import { useQuery } from '@tanstack/react-query'
import { AccountType } from '@/interfaces'
import { getOnrampQuote, type OnrampQuoteResponse } from '@/app/actions/onramp-quote'

interface UseOnrampQuoteProps {
    /** Caller's source bank account type. Maps 1:1 to source fiat currency. */
    accountType: AccountType
    enabled?: boolean
}

interface UseOnrampQuoteReturn {
    /** Rate the user actually receives after Peanut's 50bps dev fee. */
    netRate: number
    /** Bridge's raw rate, exposed for display parity with exchange-rate flows. */
    grossRate: number
    isLoading: boolean
    isError: boolean
}

/**
 * Net onramp rate for a fiat-in → USDC-out flow. Always use this (not
 * `useExchangeRate`) on onramp UIs — Peanut's 50bps developer fee is
 * already applied, so multiplying `sourceAmount * netRate` gives the
 * actual USDC the user receives.
 */
export function useOnrampQuote({ accountType, enabled = true }: UseOnrampQuoteProps): UseOnrampQuoteReturn {
    const { data, isFetching, isError } = useQuery<OnrampQuoteResponse | null>({
        queryKey: ['onrampQuote', accountType],
        queryFn: async () => {
            const { data, error } = await getOnrampQuote(accountType)
            if (error) throw new Error(error)
            return data ?? null
        },
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
        refetchOnWindowFocus: true,
        refetchInterval: 5 * 60 * 1000,
        enabled: enabled && !!accountType,
    })

    return {
        netRate: Number(data?.netRate ?? 0),
        grossRate: Number(data?.grossRate ?? 0),
        isLoading: isFetching,
        isError,
    }
}
