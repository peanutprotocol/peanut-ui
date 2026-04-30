import type { ChainMeta, TokenMeta } from '@/interfaces/chain-meta'
import { supportedPeanutChains, peanutTokenDetails } from '@/constants/general.consts'

type ChainWithTokens = ChainMeta & { networkName: string; tokens: TokenMeta[] }

export async function getSupportedChainsAndTokens(): Promise<Record<string, ChainWithTokens>> {
    const result: Record<string, ChainWithTokens> = {}
    for (const chain of supportedPeanutChains) {
        if (!chain.mainnet) continue
        result[chain.chainId] = {
            chainId: chain.chainId,
            chainIconURI: chain.icon?.url ?? '',
            networkName: chain.name,
            tokens: [],
        }
    }
    for (const chainTokens of peanutTokenDetails) {
        const bucket = result[chainTokens.chainId]
        if (!bucket) continue
        for (const token of chainTokens.tokens) {
            bucket.tokens.push({
                chainId: chainTokens.chainId,
                address: token.address,
                decimals: token.decimals,
                name: token.name,
                symbol: token.symbol,
                logoURI: token.logoURI,
                usdPrice: 0,
            })
        }
    }
    return result
}
