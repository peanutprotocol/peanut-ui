import { supportedPeanutChains } from '@/constants'
import { SUPPORTED_TOKENS } from '@/lib/url-parser/constants/tokens'
import { normalizeChainName } from './chain-resolver'

export function getTokenAddressForChain(tokenSymbol: string, chainId: string | number): string {
    // handle native ETH case
    if (tokenSymbol.toUpperCase() === 'ETH') {
        return '0x0000000000000000000000000000000000000000' // native token address
    }

    const token = SUPPORTED_TOKENS[tokenSymbol.toUpperCase()]
    if (!token) {
        throw new Error(`Unsupported token: ${tokenSymbol}`)
    }

    let resolvedChainId: number
    if (typeof chainId === 'string' && isNaN(Number(chainId))) {
        // resolve chain name to chain id
        const normalizedChainName = normalizeChainName(chainId)
        const matchedChain = supportedPeanutChains.find(
            (c) => normalizeChainName(c.name.toLowerCase()) === normalizedChainName
        )
        // if chain not found, throw error
        if (!matchedChain) {
            throw new Error(`Unsupported chain: ${chainId}`)
        }
        resolvedChainId = Number(matchedChain.chainId)
    } else {
        resolvedChainId = Number(chainId)
    }

    // for non-native tokens, check addresses
    const address = token.addresses[resolvedChainId]
    if (!address) {
        throw new Error(`Token ${tokenSymbol} not available on chain ${chainId}`)
    }

    return address
}
