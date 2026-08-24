import type { ChainWithTokens } from '@/interfaces/chain-meta'
import { supportedPeanutChains, peanutTokenDetails } from '@/constants/general.consts'
import ARBITRUM_ICON from '@/assets/chains/arbitrum.svg'
import MANTLE_ICON from '@/assets/chains/mantle.svg'

// Some chains ship an explorer-hosted icon URL that blocks hotlinking (e.g.
// Arbitrum's arbiscan.io SVG), so next/image fails to load it and the selector
// falls back to initials ("AO"). Prefer a bundled local asset for those.
const CHAIN_ICON_OVERRIDES: Record<string, string> = {
    '42161': ARBITRUM_ICON,
    // Linea's chain-details icon is an SVG served via ipfs.io — next/image
    // refuses SVG by default, so it rendered as "LI" initials. CoinGecko
    // raster instead.
    '59144': 'https://coin-images.coingecko.com/asset_platforms/images/135/small/linea.jpeg?1706606705',
    /*
     * Base/Avalanche/Mantle ship dotless ipfs.io/ipfs/<CID> icon URLs. Fine on
     * web (the next/image optimizer proxies them), but the native WebView's
     * SPA-fallback interceptor answered any dotless GET with index.html, so
     * the app showed letter avatars. The interceptor is fixed too
     * (MainActivity.java); these overrides keep the icons off ipfs.io's flaky
     * public gateway entirely.
     */
    '8453': 'https://assets.coingecko.com/asset_platforms/images/131/standard/base.png',
    '43114': 'https://assets.coingecko.com/asset_platforms/images/12/standard/avalanche.png',
    '5000': MANTLE_ICON,
}

// Same ipfs.io problem for the native-token logos on those chains.
const TOKEN_LOGO_OVERRIDES: Record<string, string> = {
    '8453:ETH': 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/svg/color/eth.svg',
    '43114:AVAX': 'https://coin-images.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png',
    '5000:MNT': MANTLE_ICON,
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
                logoURI: TOKEN_LOGO_OVERRIDES[`${chainTokens.chainId}:${token.symbol.toUpperCase()}`] ?? token.logoURI,
                usdPrice: 0,
            })
        }
    }
    return result
}
