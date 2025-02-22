import { getSquidChainsAndTokens } from '@/app/actions/squid'
import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN, chains as wagmiChains } from '@/constants'
import { interfaces } from '@squirrel-labs/peanut-sdk'
import { ChainValidationError } from '../url-parser/errors'
import { POPULAR_CHAIN_NAME_VARIANTS } from '../url-parser/parser.consts'

export async function getTokenAndChainDetails(
    tokenSymbol: string,
    chain?: string | number
): Promise<{ chain: interfaces.ISquidChain; token?: interfaces.ISquidToken }> {
    const normalizeTokenSymbol = tokenSymbol.toLowerCase()
    const squidChainsAndTokens = await getSquidChainsAndTokens()

    if (chain) {
        // const chainDetails = squidChainsAndTokens[chain.chainId]
        const chainDetails = getChainDetails(chain, squidChainsAndTokens)
        const tokenDetails = chainDetails.tokens.find((token) => token.symbol.toLowerCase() === normalizeTokenSymbol)

        console.log('tokenInfo', tokenDetails)
        return {
            chain: chainDetails,
            token: tokenDetails,
        }
    } else {
        const arbitrumChainDetails = squidChainsAndTokens[PEANUT_WALLET_CHAIN.id]
        const usdcArbTokenDetails = arbitrumChainDetails.tokens.find(
            (token) => token.address.toLowerCase() === PEANUT_WALLET_TOKEN.toLowerCase()
        )

        return {
            chain: arbitrumChainDetails,
            token: usdcArbTokenDetails,
        }
    }
}

// kushagra-notes: psuedo-code: utility of this fn? get chain details from squidChains using any chain_name/id/hex-chainId
// utility to get human-readable chain name
export function getChainDetails(
    chain: string | number,
    squidChainsAndTokens: Record<
        string,
        interfaces.ISquidChain & {
            tokens: interfaces.ISquidToken[]
        }
    >
): interfaces.ISquidChain & {
    tokens: interfaces.ISquidToken[]
} {
    let chainDetails: interfaces.ISquidChain & {
        tokens: interfaces.ISquidToken[]
    }

    // if its a string and not a number (like "base", "eth", etc.)
    if (typeof chain === 'string') {
        // const normalizedName = chain.toLowerCase()

        // check if the normalized string matches any of the variants
        for (const [_chainID, variants] of Object.entries(POPULAR_CHAIN_NAME_VARIANTS)) {
            if (variants.includes(chain.toLowerCase())) {
                const chainId = wagmiChains.find((chain) => chain.id === Number(_chainID))?.id
                if (chainId) {
                    chainDetails = squidChainsAndTokens[chainId]
                    return chainDetails
                }
            }
        }
    }

    // handle numeric and hex chain IDs
    else if (typeof Number(chain) === 'number') {
        const chainIdentifier = Number(chain)
        chainDetails = squidChainsAndTokens[chainIdentifier.toString()]
        return chainDetails
    }

    console.log('chainDetails error', chain)
    throw new ChainValidationError(`Chain ${chain} is either not supported or invalid`)
}
