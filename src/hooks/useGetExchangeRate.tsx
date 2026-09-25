import { getExchangeRate } from '@/app/actions/exchange-rate'
import { AccountType } from '@/interfaces/interfaces'
import { parsePlainPositiveRate } from '@/utils/fx.utils'
import { useQuery } from '@tanstack/react-query'

export interface IExchangeRate {
    accountType: AccountType
    enabled?: boolean
}

// `/bridge/exchange-rate` only serves Bridge bank-account types with a
// non-trivial FX rate: IBAN (EUR), CLABE (MXN), GB (GBP), CO (COP). US is
// USD↔USD = 1 by definition. Other AccountType values (MANTECA, EVM_ADDRESS,
// PEANUT_WALLET) aren't on the Bridge enum and 400 the endpoint
// (PEANUT-UI-QHR, 2026-06-02), so they get the identity rate with no call.
const BRIDGE_FX_ACCOUNT_TYPES: ReadonlySet<AccountType> = new Set([
    AccountType.IBAN,
    AccountType.CLABE,
    AccountType.GB,
    AccountType.CO_BANK_TRANSFER,
])

/**
 * Bridge's execution-side sell rate (local currency per 1 USD) for an account type.
 *
 * Fails closed for Bridge types: an API error or an unusable `sell_rate` is a
 * query error and `exchangeRate` is null — never a substituted 1, which turned
 * into a wrong withdrawal minimum. A background refresh that fails also yields
 * null, so a retained old rate is not presented as current.
 */
export default function useGetExchangeRate({ accountType, enabled = true }: IExchangeRate) {
    const {
        data,
        isFetching: isFetchingRate,
        isError,
    } = useQuery({
        queryKey: ['exchangeRate', accountType],
        queryFn: async () => {
            if (!BRIDGE_FX_ACCOUNT_TYPES.has(accountType)) return '1'

            const { data, error } = await getExchangeRate(accountType)
            if (error) throw new Error(`Bridge exchange rate unavailable for ${accountType}: ${error}`)
            if (parsePlainPositiveRate(data?.sell_rate) === null) {
                throw new Error(`Bridge exchange rate for ${accountType} has no usable sell_rate`)
            }
            return data!.sell_rate
        },
        enabled,
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 10 * 60 * 1000, // Garbage collect after 10 minutes
        refetchOnWindowFocus: true, // Refresh rates when user returns to tab
        refetchInterval: 5 * 60 * 1000, // Auto-refresh every 5 minutes
        // No retries: failures used to resolve as '1' and never retried, and a
        // retrying 429 would multiply the FX stampede (see sentry.utils). Focus,
        // the interval and a remount refetch an errored rate.
        retry: false,
    })

    return { exchangeRate: isError ? null : (data ?? null), isFetchingRate, isError }
}
