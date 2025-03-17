import { getSquidChainsAndTokens } from '@/app/actions/squid'
import {
    PEANUT_WALLET_CHAIN,
    PEANUT_WALLET_TOKEN,
    PINTA_WALLET_TOKEN,
    PINTA_WALLET_TOKEN_DECIMALS,
    PINTA_WALLET_TOKEN_NAME,
    PINTA_WALLET_TOKEN_SYMBOL,
} from '@/constants'
import { interfaces } from '@squirrel-labs/peanut-sdk'
import { ChainValidationError } from '../url-parser/errors'
import { POPULAR_CHAIN_NAME_VARIANTS } from '../url-parser/parser.consts'

import { polygon } from 'viem/chains'

const EXTRA_TOKENS_BY_CHAIN: Record<string, interfaces.ISquidToken[]> = {
    [polygon.id.toString()]: [
        {
            active: true,
            chainId: polygon.id.toString(),
            address: PINTA_WALLET_TOKEN,
            name: PINTA_WALLET_TOKEN_NAME,
            symbol: PINTA_WALLET_TOKEN_SYMBOL,
            decimals: PINTA_WALLET_TOKEN_DECIMALS,
            logoURI: 'https://polygonscan.com/token/images/pintatoken_32.png',
            usdPrice: 2.5,
        },
    ],
}

export async function getTokenAndChainDetails(
    tokenSymbol: string,
    chain?: string | number
): Promise<{ chain: interfaces.ISquidChain | null; token?: interfaces.ISquidToken }> {
    const normalizeTokenSymbol = tokenSymbol.toLowerCase()
    const squidChainsAndTokens = await getSquidChainsAndTokens()

    if (chain) {
        //TODO what about chains and tokens that are not supported by squid? we should
        //support direct token transfers for those chains
        const chainDetails = getChainDetails(chain, squidChainsAndTokens)
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
        const arbitrumChainDetails = squidChainsAndTokens[PEANUT_WALLET_CHAIN.id]
        const tokenDetails = arbitrumChainDetails.tokens.find(
            (token) => token.symbol.toLowerCase() === normalizeTokenSymbol
        )
        return {
            chain: null,
            token: tokenDetails,
        }
    }

    const arbitrumChainDetails = squidChainsAndTokens[PEANUT_WALLET_CHAIN.id]
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
    squidChainsAndTokens: Record<string, interfaces.ISquidChain & { tokens: interfaces.ISquidToken[] }>
): interfaces.ISquidChain & { tokens: interfaces.ISquidToken[] } {
    let chainDetails: interfaces.ISquidChain & { tokens: interfaces.ISquidToken[] }

    // resolve chain by name
    if (typeof chain === 'string') {
        for (const [_chainID, variants] of Object.entries(POPULAR_CHAIN_NAME_VARIANTS)) {
            if (variants.includes(chain.toLowerCase())) {
                chainDetails = squidChainsAndTokens[_chainID]
                if (chainDetails) return chainDetails
            }
        }

        // try hex chain IDs
        if (chain.startsWith('0x')) {
            const decimalChainId = parseInt(chain, 16).toString()
            chainDetails = squidChainsAndTokens[decimalChainId]
            if (chainDetails) return chainDetails
        }
    }

    // handle numeric chain IDs
    const numericChainId = typeof chain === 'string' ? parseInt(chain) : chain
    if (!isNaN(numericChainId)) {
        chainDetails = squidChainsAndTokens[numericChainId.toString()]
        if (chainDetails) return chainDetails
    }

    throw new ChainValidationError(`Chain ${chain} is either not supported or invalid`)
}
