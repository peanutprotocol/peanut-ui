import { tokenSelectorContext } from '@/context/tokenSelector.context'
import { interfaces } from '@squirrel-labs/peanut-sdk'
import { useContext } from 'react'

interface TokenChainIconInputs {
    chainId?: string | number
    tokenAddress?: string
    tokenSymbol?: string
}

export interface TokenChainIconData {
    tokenIconUrl?: string
    chainIconUrl?: string
    resolvedChainName?: string
    resolvedTokenSymbol?: string
    chainFound: boolean
    tokenFound: boolean
    chainDetails?: interfaces.ISquidChain & { tokens: interfaces.ISquidToken[] }
    tokenDetails?: interfaces.ISquidToken
}

export const useTokenChainIcons = ({
    chainId,
    tokenAddress,
    tokenSymbol,
}: TokenChainIconInputs): TokenChainIconData => {
    const { supportedSquidChainsAndTokens } = useContext(tokenSelectorContext)

    const defaultResponse: TokenChainIconData = {
        chainFound: false,
        tokenFound: false,
    }

    if (!chainId || (!tokenAddress && !tokenSymbol)) {
        return defaultResponse
    }

    const chainIdStr = String(chainId)
    const chainInfo = supportedSquidChainsAndTokens[chainIdStr]

    if (!chainInfo) {
        // If chainInfo is not found, use chainIdStr for display name, if available
        const name = chainIdStr ? `Chain ID: ${chainIdStr}` : 'Unknown Chain'
        return { ...defaultResponse, resolvedChainName: name }
    }

    // use axelarChainName if available, otherwise fallback to simple CHAIN
    const resolvedChainName = chainInfo.axelarChainName ? chainInfo.axelarChainName : `CHAIN`
    let tokenInfo: interfaces.ISquidToken | undefined = undefined

    if (tokenAddress) {
        tokenInfo = chainInfo.tokens.find((t) => t.address.toLowerCase() === tokenAddress.toLowerCase())
    } else if (tokenSymbol) {
        const lowerSymbol = tokenSymbol.toLowerCase()
        const potentialTokens = chainInfo.tokens.filter((t) => t.symbol.toLowerCase() === lowerSymbol)
        if (potentialTokens.length === 1) {
            tokenInfo = potentialTokens[0]
        } else if (potentialTokens.length > 1) {
            tokenInfo = potentialTokens.find((t) => t.symbol === tokenSymbol) || potentialTokens[0]
        }
    }

    if (!tokenInfo) {
        return {
            ...defaultResponse,
            chainFound: true,
            chainIconUrl: chainInfo.chainIconURI,
            resolvedChainName: resolvedChainName,
            resolvedTokenSymbol: tokenSymbol || 'Unknown Token',
            chainDetails: chainInfo,
        }
    }

    return {
        tokenIconUrl: tokenInfo.logoURI,
        chainIconUrl: chainInfo.chainIconURI,
        resolvedChainName: resolvedChainName,
        resolvedTokenSymbol: tokenInfo.symbol,
        chainFound: true,
        tokenFound: true,
        chainDetails: chainInfo,
        tokenDetails: tokenInfo,
    }
}
