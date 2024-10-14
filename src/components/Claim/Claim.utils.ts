import * as _interfaces from './Claim.interfaces'
import * as interfaces from '@/interfaces'
export function mapToIPeanutChainDetailsArray(
    data: _interfaces.SquidChainWithTokens[] | undefined
): _interfaces.CombinedType[] {
    if (!data) return []

    const combinedArray: _interfaces.CombinedType[] = []
    data.forEach((chain) => {
        const chainDetails: interfaces.IPeanutChainDetails = {
            name: chain.axelarChainName || '',
            chain: chain.chainType || '',
            icon: {
                url: chain.chainIconURI || '',
                format: '',
            },
            rpc: [],
            features: [],
            faucets: [],
            nativeCurrency: {
                name: '',
                symbol: '',
                decimals: 0,
            },
            infoURL: '',
            shortName: '',
            chainId: chain.chainId || '',
            networkId: 0,
            slip44: 0,
            ens: {
                registry: '',
            },
            explorers: [],
            mainnet: true,
        }

        const combinedObject: _interfaces.CombinedType = {
            ...chainDetails,
            tokens: [],
        }

        if (chain.tokens && chain.tokens.length > 0) {
            chain.tokens.forEach((token) => {
                combinedObject.tokens.push({
                    address: token.address || '',
                    name: token.name || '',
                    symbol: token.symbol || '',
                    decimals: 0,
                    logoURI: token.logoURI || '',
                    chainId: chain.chainId || '',
                })
            })
        }

        combinedArray.push(combinedObject) // Pushing the combined object for the chain
    })

    return combinedArray
}

export const sortCrossChainDetails = (details: any[], order: any[], sourceChainId: string) => {
    const orderMap = new Map(order.map((item, index) => [item.chainId, index]))
    return details.sort((a, b) => {
        if (a.chainId === sourceChainId) return -1
        if (b.chainId === sourceChainId) return 1

        const indexA = orderMap.get(a.chainId)
        const indexB = orderMap.get(b.chainId)
        if (indexA === undefined || indexB === undefined) {
            return 0 // Default to no order if not found
        }
        return indexA - indexB
    })
}
