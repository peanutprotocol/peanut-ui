import { getSupportedChainsAndTokens } from '@/app/actions/supported-chains'
import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN } from '@/constants/zerodev.consts'
import type { ChainMeta, TokenMeta } from '@/interfaces/chain-meta'
import { ChainValidationError } from '../url-parser/errors'
import { POPULAR_CHAIN_NAME_VARIANTS } from '../url-parser/parser.consts'

// This is used to support other tokens, specifically for reward tokens for
// example, it was used to support beer token in polygon in early versions of the app
// We keep the mapping for future configuration
const EXTRA_TOKENS_BY_CHAIN: Record<string, TokenMeta[]> = {}

export async function getTokenAndChainDetails(
    tokenSymbol: string,
    chain?: string | number
): Promise<{ chain: ChainMeta | null; token?: TokenMeta }> {
    const normalizeTokenSymbol = tokenSymbol.toLowerCase()
    const supportedChainsAndTokens = await getSupportedChainsAndTokens()

    if (chain) {
        const chainDetails = getChainDetails(chain, supportedChainsAndTokens)
        let tokenDetails = chainDetails.tokens.find((token) => token.symbol.toLowerCase() === normalizeTokenSymbol)
        if (!tokenDetails) {
            tokenDetails = EXTRA_TOKENS_BY_CHAIN[chainDetails.chainId]?.find(
                (token) => token.symbol.toLowerCase() === normalizeTokenSymbol
            )
        }
        return {
            chain: chainDetails,
            token: tokenDetails,
        }
    }

    if (tokenSymbol) {
        const arbitrumChainDetails = supportedChainsAndTokens[PEANUT_WALLET_CHAIN.id]
        const tokenDetails = arbitrumChainDetails.tokens.find(
            (token) => token.symbol.toLowerCase() === normalizeTokenSymbol
        )
        return {
            chain: null,
            token: tokenDetails,
        }
    }

    const arbitrumChainDetails = supportedChainsAndTokens[PEANUT_WALLET_CHAIN.id]
    const usdcArbTokenDetails = arbitrumChainDetails.tokens.find(
        (token) => token.address.toLowerCase() === PEANUT_WALLET_TOKEN.toLowerCase()
    )

    return {
        chain: arbitrumChainDetails,
        token: usdcArbTokenDetails,
    }
}

// utility to get human-readable chain name
export function getChainDetails(
    chain: string | number,
    supportedChainsAndTokens: Record<string, ChainMeta & { tokens: TokenMeta[] }>
): ChainMeta & { tokens: TokenMeta[] } {
    let chainDetails: ChainMeta & { tokens: TokenMeta[] }

    // resolve chain by name
    if (typeof chain === 'string') {
        for (const [_chainID, variants] of Object.entries(POPULAR_CHAIN_NAME_VARIANTS)) {
            if (variants.includes(chain.toLowerCase())) {
                chainDetails = supportedChainsAndTokens[_chainID]
                if (chainDetails) return chainDetails
            }
        }

        // try hex chain IDs
        if (chain.startsWith('0x')) {
            const decimalChainId = parseInt(chain, 16).toString()
            chainDetails = supportedChainsAndTokens[decimalChainId]
            if (chainDetails) return chainDetails
        }
    }

    // handle numeric chain IDs
    const numericChainId = typeof chain === 'string' ? parseInt(chain) : chain
    if (!isNaN(numericChainId)) {
        chainDetails = supportedChainsAndTokens[numericChainId.toString()]
        if (chainDetails) return chainDetails
    }

    throw new ChainValidationError(`Chain ${chain} is either not supported or invalid`)
}
