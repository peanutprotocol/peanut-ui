import { getSquidChainsAndTokens } from '@/app/actions/squid'
import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN } from '@/constants'
import { interfaces } from '@squirrel-labs/peanut-sdk'
import { ChainValidationError } from '../url-parser/errors'
import { POPULAR_CHAIN_NAME_VARIANTS } from '../url-parser/parser.consts'

export async function getTokenAndChainDetails(
    tokenSymbol: string,
    chain?: string | number
): Promise<{ chain: interfaces.ISquidChain | null; token?: interfaces.ISquidToken }> {
    const normalizeTokenSymbol = tokenSymbol.toLowerCase()
    const squidChainsAndTokens = await getSquidChainsAndTokens()

    if (chain) {
        const chainDetails = getChainDetails(chain, squidChainsAndTokens)
        const tokenDetails = chainDetails.tokens.find((token) => token.symbol.toLowerCase() === normalizeTokenSymbol)
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

// kushagra-notes: psuedo-code: utility of this fn? get chain details from squidChains using any chain_name/id/hex-chainId
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
