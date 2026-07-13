import type { ChainWithTokens } from '@/interfaces/chain-meta'
import { supportedPeanutChains, peanutTokenDetails } from '@/constants/general.consts'
import ARBITRUM_ICON from '@/assets/chains/arbitrum.svg'

// Some chains ship an explorer-hosted icon URL that blocks hotlinking (e.g.
// Arbitrum's arbiscan.io SVG), so next/image fails to load it and the selector
// falls back to initials ("AO"). Prefer a bundled local asset for those.
const CHAIN_ICON_OVERRIDES: Record<string, string> = {
    '42161': ARBITRUM_ICON,
    // Linea's chain-details icon is an SVG served via ipfs.io — next/image
    // refuses SVG by default, so it rendered as "LI" initials. CoinGecko
    // raster instead. (Avalanche/Mantle ipfs icons are PNG and render fine.)
    '59144': 'https://coin-images.coingecko.com/asset_platforms/images/135/small/linea.jpeg?1706606705',
}

export async function getSupportedChainsAndTokens(): Promise<Record<string, ChainWithTokens>> {
    const result: Record<string, ChainWithTokens> = {}
    for (const chain of supportedPeanutChains) {
        if (!chain.mainnet) continue
        result[chain.chainId] = {
            chainId: chain.chainId,
            chainIconURI: CHAIN_ICON_OVERRIDES[String(chain.chainId)] ?? chain.icon?.url ?? '',
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
