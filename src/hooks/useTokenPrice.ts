import { useQuery } from '@tanstack/react-query'
import { fetchTokenPrice } from '@/app/actions/tokens'
import {
    PEANUT_WALLET_TOKEN,
    PEANUT_WALLET_TOKEN_DECIMALS,
    PEANUT_WALLET_TOKEN_SYMBOL,
    PEANUT_WALLET_TOKEN_NAME,
    PEANUT_WALLET_CHAIN,
    PEANUT_WALLET_TOKEN_IMG_URL,
    STABLE_COINS,
    supportedMobulaChains,
} from '@/constants'
import { type ITokenPriceData } from '@/interfaces'
import * as Sentry from '@sentry/nextjs'
import { interfaces } from '@squirrel-labs/peanut-sdk'

interface UseTokenPriceParams {
    tokenAddress: string | undefined
    chainId: string | undefined
    supportedSquidChainsAndTokens: Record<
        string,
        interfaces.ISquidChain & { networkName: string; tokens: interfaces.ISquidToken[] }
    >
    isPeanutWallet: boolean
}

/**
 * Hook to fetch and cache token price data using TanStack Query
 *
 * This replaces the manual useEffect in tokenSelector.context.tsx with:
 * - Automatic caching (60s stale time)
 * - Automatic deduplication (same token/chain = single request)
 * - Built-in retry logic
 * - No manual cleanup needed
 *
 * Handles three cases:
 * 1. Peanut Wallet USDC → always $1 (no API call)
 * 2. Known stablecoins → always $1 (no API call)
 * 3. Other tokens → fetch from Mobula API (with caching) - @dev note: mobula is a bit unreliable
 *
 * @returns TanStack Query result with token price data
 */
export const useTokenPrice = ({
    tokenAddress,
    chainId,
    supportedSquidChainsAndTokens,
    isPeanutWallet,
}: UseTokenPriceParams) => {
    return useQuery({
        queryKey: ['tokenPrice', tokenAddress, chainId, isPeanutWallet],
        queryFn: async (): Promise<ITokenPriceData | undefined> => {
            try {
                // Case 1: Peanut Wallet USDC (always $1)
                if (isPeanutWallet && tokenAddress === PEANUT_WALLET_TOKEN) {
                    return {
                        price: 1,
                        decimals: PEANUT_WALLET_TOKEN_DECIMALS,
                        symbol: PEANUT_WALLET_TOKEN_SYMBOL,
                        name: PEANUT_WALLET_TOKEN_NAME,
                        address: PEANUT_WALLET_TOKEN,
                        chainId: PEANUT_WALLET_CHAIN.id.toString(),
                        logoURI: PEANUT_WALLET_TOKEN_IMG_URL,
                    } as ITokenPriceData
                }

                // Case 2: Known stablecoin from supported tokens (always $1)
                const token = supportedSquidChainsAndTokens[chainId!]?.tokens.find(
                    (t) => t.address.toLowerCase() === tokenAddress!.toLowerCase()
                )

                if (token && STABLE_COINS.includes(token.symbol.toUpperCase())) {
                    return {
                        price: 1,
                        decimals: token.decimals,
                        symbol: token.symbol,
                        name: token.name,
                        address: token.address,
                        chainId: chainId,
                        logoURI: token.logoURI,
                    } as ITokenPriceData
                }

                // Case 3: Check if chain is supported by Mobula
                if (!supportedMobulaChains.some((chain) => chain.chainId == chainId)) {
                    return undefined
                }

                // Case 4: Fetch actual price from API
                const tokenPriceResponse = await fetchTokenPrice(tokenAddress!, chainId!)

                if (tokenPriceResponse?.price) {
                    return tokenPriceResponse
                }

                return undefined
            } catch (error) {
                // Preserve Sentry error reporting from original implementation
                Sentry.captureException(error)
                console.error('error fetching tokenPrice, falling back to tokenDenomination')
                return undefined
            }
        },
        enabled: !!tokenAddress && !!chainId, // Only run when both are defined
        staleTime: 60 * 1000, // 1 minute (prices don't change that often)
        gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
        refetchOnWindowFocus: true, // Refresh when user returns to tab
        retry: 2, // Retry failed requests twice
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000), // Exponential backoff, max 5s
    })
}
