'use client'

import { useQuery } from '@tanstack/react-query'
import { type TransactionDetails } from '@/components/TransactionDetails/transactionTransformer'
import { slugify } from '@/utils/general.utils'

interface TokenDisplayData {
    symbol: string
    icon: string
}

/**
 * Token symbol + icon for the receipt's token-and-network row. Wire data wins;
 * CoinGecko is the fallback for legacy entries that only carry a chain name.
 * Tanstack query (not useState/useEffect) per the DS state decision table.
 */
export function useTokenDisplay(transaction: TransactionDetails | null): {
    tokenData: TokenDisplayData | null
    isLoading: boolean
} {
    const details = transaction?.tokenDisplayDetails
    const fromWire =
        details?.tokenIconUrl && details?.tokenSymbol
            ? { symbol: details.tokenSymbol, icon: details.tokenIconUrl }
            : null
    const needsFetch = !!details && !fromWire && !!details.chainName && !!transaction?.tokenAddress

    const { data, isLoading } = useQuery({
        queryKey: ['coingecko-token', details?.chainName, transaction?.tokenAddress],
        enabled: needsFetch,
        staleTime: Infinity,
        retry: false,
        queryFn: async (): Promise<TokenDisplayData | null> => {
            const chainName = slugify(details!.chainName!)
            const res = await fetch(
                `https://api.coingecko.com/api/v3/coins/${chainName}/contract/${transaction!.tokenAddress}`
            )
            if (!res.ok) {
                throw new Error(`CoinGecko API error: ${res.status} ${res.statusText}`)
            }
            const tokenDetails = await res.json()
            return { symbol: tokenDetails.symbol, icon: tokenDetails.image.large }
        },
    })

    return {
        tokenData: fromWire ?? data ?? null,
        isLoading: needsFetch && isLoading,
    }
}
