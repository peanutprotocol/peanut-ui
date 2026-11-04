import type { Address } from 'viem'
import { erc20Abi } from 'viem'
import { areEvmAddressesEqual } from './general.utils'
import { NATIVE_TOKEN_ADDRESS, NATIVE_TOKEN_PROXY_ADDRESS } from '@/constants/tokens.consts'
import { supportedPeanutChains, peanutTokenDetails } from '@/constants/token-registry.consts'
import { resolveChainRegistryEntry } from '@/constants/chainRegistry.consts'
import type { ChainWithTokens } from '@/interfaces/chain-meta'
/*
 * Type-only, so this module does not pull `actions/clients` — and through it
 * viem's ~700-chain registry — into every bundle that imports these utils.
 * `fetchTokenSymbol` below imports the client at call time instead.
 */
import { type ChainId } from '@/app/actions/clients'
import * as Sentry from '@/utils/sentry-lazy'

// Re-export so existing call sites that import these from '@/utils/token.utils'
// keep working. New code should import from '@/constants/tokens.consts' directly.
export { NATIVE_TOKEN_ADDRESS, NATIVE_TOKEN_PROXY_ADDRESS }

export const checkTokenSupportsXChain = (
    tokenAddress: string,
    chainId: string,
    supportedChainsAndTokens: Record<string, ChainWithTokens>
): boolean => {
    if (tokenAddress === NATIVE_TOKEN_ADDRESS) {
        return (
            supportedChainsAndTokens[chainId]?.tokens.some((token) =>
                areEvmAddressesEqual(token.address, NATIVE_TOKEN_PROXY_ADDRESS)
            ) ?? false
        )
    }

    return (
        supportedChainsAndTokens[chainId]?.tokens.some((token) => areEvmAddressesEqual(token.address, tokenAddress)) ??
        false
    )
}

export const getExplorerUrl = (chainId: string) => {
    const explorers = supportedPeanutChains.find((detail) => detail.chainId === chainId)?.explorers
    // if the explorers array has blockscout, return the blockscout url, else return the first one
    if (explorers?.find((explorer) => explorer.url.includes('blockscout'))) {
        return explorers?.find((explorer) => explorer.url.includes('blockscout'))?.url
    } else {
        return explorers?.[0].url
    }
}

/** Build a transaction proof URL from any chain identifier the API emits.
 *  EVM chains keep using chain-details.json; non-EVM explorer shapes live in
 *  the canonical chain registry. */
export const getTransactionExplorerUrl = (chainIdentifier: string, transactionHash: string) => {
    const exactIdentifier = chainIdentifier.trim()
    const chain = resolveChainRegistryEntry(exactIdentifier)
    const aliasPrefix = chain?.aliasTransactionExplorerUrlPrefixes?.[exactIdentifier]
    if (aliasPrefix) {
        return `${aliasPrefix}${encodeURIComponent(transactionHash)}`
    }
    if (chain?.transactionExplorerUrlPrefix) {
        return `${chain.transactionExplorerUrlPrefix}${encodeURIComponent(transactionHash)}`
    }
    const baseUrl = getExplorerUrl(chain?.id ?? exactIdentifier)
    return baseUrl ? `${baseUrl}/tx/${transactionHash}` : undefined
}

/** Gets the token decimals for a given token address and chain ID. */
export function getTokenDecimals(tokenAddress: string, chainId: string): number | undefined {
    return peanutTokenDetails
        .find((chain) => chain.chainId === chainId)
        ?.tokens.find((token) => areEvmAddressesEqual(token.address, tokenAddress))?.decimals
}

export function getTokenDetails({ tokenAddress, chainId }: { tokenAddress: Address; chainId: string }):
    | {
          symbol: string
          name: string
          decimals: number
      }
    | undefined {
    const chainTokens = peanutTokenDetails.find((c) => c.chainId === chainId)?.tokens
    if (!chainTokens) return undefined
    const tokenDetails = chainTokens.find((token) => areEvmAddressesEqual(token.address, tokenAddress))
    if (!tokenDetails) return undefined
    return tokenDetails
}

/**
 * Gets the token symbol for a given token address and chain ID.
 *
 * From the sdk token list, if you need to be sure to get a token symbol you
 * should use the {@link fetchTokenSymbol} function.
 *
 * @returns The token symbol, or undefined if not found.
 */
export function getTokenSymbol(tokenAddress: string | undefined, chainId: string | undefined): string | undefined {
    if (!tokenAddress || !chainId) return undefined

    const chainTokens = peanutTokenDetails.find((chain) => chain.chainId === chainId)?.tokens
    if (!chainTokens) return undefined

    return chainTokens.find((token) => areEvmAddressesEqual(token.address, tokenAddress))?.symbol
}

/**
 * Fetches the token symbol for a given token address and chain ID.
 *
 * This function first checks the sdk token list, and if the token is not found
 * it fetches the token contract details and tries to get the symbol from the
 * contract. If you are ok with only checking the sdk token list, and don't want
 * to await you can use the {@link getTokenSymbol} function.
 *
 * @returns The token symbol, or undefined if not found.
 */
export async function fetchTokenSymbol(tokenAddress: string, chainId: string): Promise<string | undefined> {
    let tokenSymbol = getTokenSymbol(tokenAddress, chainId)
    if (!tokenSymbol) {
        try {
            const { getPublicClient } = await import('@/app/actions/clients')
            const client = getPublicClient(Number(chainId) as ChainId)
            tokenSymbol = (await client.readContract({
                address: tokenAddress as Address,
                abi: erc20Abi,
                functionName: 'symbol',
                args: [],
            })) as string
        } catch (error) {
            Sentry.captureException(error)
            console.error('Error fetching token symbol:', error)
        }
    }
    if (!tokenSymbol) {
        console.error(`Failed to get token symbol for token ${tokenAddress} on chain ${chainId}`)
    }
    return tokenSymbol
}
