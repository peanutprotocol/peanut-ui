'use client'

import { captureException } from '@sentry/nextjs'
import { useQuery } from '@tanstack/react-query'
import { type TransactionDetails } from '@/components/TransactionDetails/transactionTransformer'
import { resolveChainRegistryEntry } from '@/constants/chainRegistry.consts'

interface TokenDisplayData {
    symbol: string
    icon: string | undefined
}

/**
 * Token symbol + icon for the receipt's token-and-network row. Wire data wins;
 * CoinGecko fills a missing icon or symbol. The lookup is optional metadata:
 * a failure never hides a symbol the wire already knows.
 * Tanstack query (not useState/useEffect) per the DS state decision table.
 */
export function useTokenDisplay(transaction: TransactionDetails | null): TokenDisplayData | null {
    const details = transaction?.tokenDisplayDetails
    // history uses chainId "0" for Solana, which only the chain name resolves
    const platformId = (
        resolveChainRegistryEntry(details?.chainId ?? '') ?? resolveChainRegistryEntry(details?.chainName ?? '')
    )?.coingeckoPlatformId
    const needsFetch =
        !!details && !(details.tokenIconUrl && details.tokenSymbol) && !!platformId && !!transaction?.tokenAddress

    const { data } = useQuery({
        queryKey: ['coingecko-token', platformId, transaction?.tokenAddress],
        enabled: needsFetch,
        staleTime: Infinity,
        retry: false,
        queryFn: async (): Promise<{ symbol: string; icon: string } | null> => {
            try {
                const res = await fetch(
                    `https://api.coingecko.com/api/v3/coins/${platformId}/contract/${transaction!.tokenAddress}`
                )
                // 404 = CoinGecko doesn't list this token; the fallback icon covers it
                if (res.status === 404) return null
                if (!res.ok) throw new Error(`CoinGecko API error: ${res.status} ${res.statusText}`)
                const tokenDetails = await res.json()
                return { symbol: tokenDetails.symbol, icon: tokenDetails.image.large }
            } catch (error) {
                captureException(error)
                return null
            }
        },
    })

    const symbol = details?.tokenSymbol ?? data?.symbol
    return symbol ? { symbol, icon: details?.tokenIconUrl ?? data?.icon } : null
}
