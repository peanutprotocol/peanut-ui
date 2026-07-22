import { getExchangeRate } from '@/app/actions/exchange-rate'
import { AccountType } from '@/interfaces/interfaces'
import { useQuery } from '@tanstack/react-query'

export interface IExchangeRate {
    accountType: AccountType
    enabled?: boolean
}

/**
 * Used to get exchange rate for a given account type using TanStack Query
 * @returns {string, boolean} The exchange rate for the given account type and a boolean indicating if the rate is being fetched
 */
// `/bridge/exchange-rate` only serves Bridge bank-account types with a
// non-trivial FX rate: IBAN (EUR), CLABE (MXN), GB (GBP). US is USD↔USD = 1
// by definition. Other AccountType values (MANTECA, EVM_ADDRESS, PEANUT_WALLET)
// aren't on the Bridge enum and 400 the endpoint (PEANUT-UI-QHR, 2026-06-02).
// Treat those like US — '1' is a safe display fallback; consumers already
// degrade gracefully on '1' (and the only consumer that needs a real Manteca
// FX rate routes through `getCachedCurrencyPrice` in actions/currency.ts).
// TODO: Manteca-currency display rates should route through that helper too
// instead of returning '1'; separate PR.
const BRIDGE_FX_ACCOUNT_TYPES: ReadonlySet<AccountType> = new Set([AccountType.IBAN, AccountType.CLABE, AccountType.GB])

export default function useGetExchangeRate({ accountType, enabled = true }: IExchangeRate) {
    const { data: exchangeRate, isFetching: isFetchingRate } = useQuery({
        queryKey: ['exchangeRate', accountType],
        queryFn: async () => {
            // Anything not on the Bridge FX set returns the passthrough rate.
            // Includes AccountType.US (USD↔USD = 1).
            if (!BRIDGE_FX_ACCOUNT_TYPES.has(accountType)) {
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
