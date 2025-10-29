import { getExchangeRate } from '@/app/actions/exchange-rate'
import { AccountType } from '@/interfaces'
import { useQuery } from '@tanstack/react-query'

export interface IExchangeRate {
    accountType: AccountType
    enabled?: boolean
}

/**
 * Used to get exchange rate for a given account type using TanStack Query
 * @returns {string, boolean} The exchange rate for the given account type and a boolean indicating if the rate is being fetched
 */
export default function useGetExchangeRate({ accountType, enabled = true }: IExchangeRate) {
    const { data: exchangeRate, isFetching: isFetchingRate } = useQuery({
        queryKey: ['exchangeRate', accountType],
        queryFn: async () => {
            // US accounts have 1:1 exchange rate
            if (accountType === AccountType.US) {
                return '1'
            }

            try {
                const { data, error: rateError } = await getExchangeRate(accountType)

                if (rateError) {
                    console.error('Failed to fetch exchange rate:', rateError)
                    // Return default rate to 1 for error cases
                    return '1'
                }

                return data?.sell_rate || '1'
            } catch (error) {
                console.error('An error occurred while fetching the exchange rate:', error)
                return '1'
            }
        },
        enabled,
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 10 * 60 * 1000, // Garbage collect after 10 minutes
        refetchOnWindowFocus: true, // Refresh rates when user returns to tab
        refetchInterval: 5 * 60 * 1000, // Auto-refresh every 5 minutes
        retry: 3,
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    })

    return { exchangeRate: exchangeRate ?? null, isFetchingRate }
}
