import type { ChainWithTokens } from '@/interfaces/chain-meta'
import { supportedPeanutChains, peanutTokenDetails } from '@/constants/token-registry.consts'
import { CHAIN_REGISTRY } from '@/constants/chainRegistry.consts'
import { NATIVE_TOKEN_ADDRESS, NATIVE_TOKEN_PROXY_ADDRESS } from '@/constants/tokens.consts'
import { TOKEN_LOGOS } from '@/constants/rhino.consts'
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

/*
 * One logo per native token, whatever chain carries it. The catalog gives
 * native ETH the CHAIN's logo on several chains (Arbitrum's arbiscan SVG,
 * Optimism's OP logo, Scroll's), so the token-first selector — which shows a
 * token with the logo of its first network, Arbitrum — drew ETH as Arbitrum.
 * Others ship SVGs next/image refuses (BNB, POL/MATIC, mainnet ETH) or
 * dotless ipfs.io URLs the native WebView cannot load (Base ETH, AVAX, MNT).
 */
const NATIVE_TOKEN_LOGOS: Record<string, string> = {
    ETH: TOKEN_LOGOS.ETH,
    BNB: 'https://assets.coingecko.com/coins/images/12591/thumb/binance-coin-logo.png?1696512401',
    MATIC: 'https://assets.coingecko.com/coins/images/14073/thumb/matic.png?1696513797',
    POL: 'https://assets.coingecko.com/coins/images/14073/thumb/matic.png?1696513797',
    AVAX: 'https://coin-images.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png',
    MNT: MANTLE_ICON,
}

/** the canonical logo for a native token, else the catalog's own logo */
export function tokenLogo(address: string, symbol: string, catalogLogo: string): string {
    const lower = address.toLowerCase()
    const isNative = lower === NATIVE_TOKEN_ADDRESS || lower === NATIVE_TOKEN_PROXY_ADDRESS.toLowerCase()
    return (isNative && NATIVE_TOKEN_LOGOS[symbol.toUpperCase()]) || catalogLogo
}

// TASK-21667: chain-details.json ships mostly SVG icon URLs, and next/image
// refuses image/svg+xml without dangerouslyAllowSVG — so Ethereum, Optimism,
// BNB and friends rendered as letter initials in the withdraw network list.
// The chain registry already curates a raster logo per withdraw-eligible
// chain; those win over the chain-details icon. CHAIN_ICON_OVERRIDES stays
// first (bundled/native-webview rationale above).
const REGISTRY_CHAIN_LOGOS: Record<string, string> = Object.fromEntries(
    CHAIN_REGISTRY.flatMap((c) =>
        c.logoUrl ? [c.id, ...(c.aliasIds ?? [])].map((id) => [id, c.logoUrl!] as const) : []
    )
)

export async function getSupportedChainsAndTokens(): Promise<Record<string, ChainWithTokens>> {
    const result: Record<string, ChainWithTokens> = {}
    for (const chain of supportedPeanutChains) {
        if (!chain.mainnet) continue
        result[chain.chainId] = {
            chainId: chain.chainId,
            chainIconURI:
                CHAIN_ICON_OVERRIDES[String(chain.chainId)] ??
                REGISTRY_CHAIN_LOGOS[String(chain.chainId)] ??
                chain.icon?.url ??
                '',
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
                logoURI: tokenLogo(token.address, token.symbol, token.logoURI),
            })
        }
    }
    return result
}
