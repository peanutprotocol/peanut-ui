import { Chain } from 'viem'
import { SUPPORTED_TOKENS } from '../url-parser/constants/tokens'
import { TokenValidationError } from '../url-parser/errors'
import { TokenInfo } from '../url-parser/types/token'
import { normalizeChainName, supportsNativeEth } from './chain-resolver'

export interface ValidatedToken {
    info: TokenInfo
    address?: string // optional because ETH is native
    isNative: boolean
}

export function validateToken(tokenSymbol: string, chain?: Chain): ValidatedToken {
    const normalizedSymbol = tokenSymbol.toUpperCase()
    const tokenInfo = SUPPORTED_TOKENS[normalizedSymbol]

    if (!tokenInfo) {
        throw new TokenValidationError(`Unsupported token: ${tokenSymbol}`)
    }

    if (chain) {
        const normalizedChainName = normalizeChainName(chain.name)
        const isNative = normalizedSymbol === 'ETH' && supportsNativeEth(normalizedChainName)

        if (!isNative && !tokenInfo.addresses[chain.id]) {
            throw new TokenValidationError(`${tokenSymbol} is not supported on ${chain.name}`)
        }

        return {
            info: tokenInfo,
            address: isNative ? undefined : tokenInfo.addresses[chain.id],
            isNative,
        }
    }
    // if no chain specified, just return token info
    return {
        info: tokenInfo,
        isNative: tokenSymbol === 'ETH',
    }
}
