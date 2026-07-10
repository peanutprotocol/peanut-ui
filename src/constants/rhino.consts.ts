import type { RhinoChainType } from '@/services/services.types'

/** Chain name to logo URL mapping - reusable across the app */
export const CHAIN_LOGOS = {
    ARBITRUM: 'https://assets.coingecko.com/asset_platforms/images/33/standard/AO_logomark.png?1706606717',
    ETHEREUM: 'https://assets.coingecko.com/asset_platforms/images/279/standard/ethereum.png?1706606803',
    BASE: 'https://assets.coingecko.com/asset_platforms/images/131/standard/base.png?1759905869',
    OPTIMISM: 'https://assets.coingecko.com/asset_platforms/images/41/standard/optimism.png?1706606778',
    GNOSIS: 'https://assets.coingecko.com/asset_platforms/images/11062/standard/Aatar_green_white.png?1706606458',
    POLYGON: 'https://assets.coingecko.com/asset_platforms/images/15/standard/polygon_pos.png?1706606645',
    BNB: 'https://assets.coingecko.com/asset_platforms/images/1/standard/bnb_smart_chain.png?1706606721',
    KATANA: 'https://assets.coingecko.com/asset_platforms/images/32239/standard/katana.jpg?1751496126',
    SCROLL: 'https://assets.coingecko.com/asset_platforms/images/153/standard/scroll.jpeg?1706606782',
    CELO: 'https://assets.coingecko.com/asset_platforms/images/21/standard/celo.jpeg?1711358666',
    TRON: 'https://assets.coingecko.com/asset_platforms/images/1094/standard/TRON_LOGO.png?1706606652',
    SOLANA: 'https://assets.coingecko.com/asset_platforms/images/5/standard/solana.png?1706606708',
    TEMPO: 'https://icons.llamao.fi/icons/chains/rsz_tempo.jpg',
} as const

/** Token symbol to logo URL mapping - reusable across the app */
export const TOKEN_LOGOS = {
    USDT: 'https://assets.coingecko.com/coins/images/325/standard/Tether.png?1696501661',
    USDC: 'https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png',
    ETH: 'https://assets.coingecko.com/coins/images/279/standard/ethereum.png?1696501628',
} as const

export type ChainName = keyof typeof CHAIN_LOGOS
export type TokenName = keyof typeof TOKEN_LOGOS

// Mirrors Rhino's live SDA config (`depositAddresses.getSupportedConfigs()`).
// Scroll was removed 2026-06-11: Rhino's live config no longer returns an SDA
// entry for it, and a deposit on an unsupported chain is silently lost.
export const SUPPORTED_EVM_CHAINS = [
    'ARBITRUM',
    'ETHEREUM',
    'BASE',
    'OPTIMISM',
    'BNB',
    'POLYGON',
    'KATANA',
    'GNOSIS',
    'CELO',
    // TEMPO added 2026-07-10: live SDA catalog lists it with USDC+USDT (the
    // REQUIRED_TOKENS bar). KAIA/PLASMA stay excluded — USDT-only on Rhino, and
    // the deposit UI advertises USDC per EVM family, so a USDC deposit there
    // would be silently lost.
    'TEMPO',
] as const

export const OTHER_SUPPORTED_CHAINS = ['SOLANA', 'TRON'] as const

/** Rhino-supported chains with their logos */
export const RHINO_SUPPORTED_CHAINS = (Object.keys(CHAIN_LOGOS) as ChainName[]).map((name) => ({
    name,
    logoUrl: CHAIN_LOGOS[name],
}))

export const RHINO_SUPPORTED_EVM_CHAINS = RHINO_SUPPORTED_CHAINS.filter((chain) =>
    (SUPPORTED_EVM_CHAINS as readonly string[]).includes(chain.name)
)

export const RHINO_SUPPORTED_OTHER_CHAINS = RHINO_SUPPORTED_CHAINS.filter((chain) =>
    (OTHER_SUPPORTED_CHAINS as readonly string[]).includes(chain.name)
)

export const NETWORK_LABELS: Record<RhinoChainType, string> = {
    EVM: 'EVM',
    SOL: 'Solana',
    TRON: 'Tron',
}

/** representative logo per chain type (ethereum for EVM) */
export const NETWORK_LOGOS: Record<RhinoChainType, string> = {
    EVM: CHAIN_LOGOS.ETHEREUM,
    SOL: CHAIN_LOGOS.SOLANA,
    TRON: CHAIN_LOGOS.TRON,
}

/**
 * Tokens we advertise per chain type — mirrors Rhino's live SDA config
 * (`depositAddresses.getSupportedConfigs()`). A token sent to an SDA that
 * Rhino doesn't accept on that chain is silently lost (no webhook, no
 * intent), so never list a token here without confirming Rhino accepts it.
 * ETH is EVM-only; TRON is USDT-only (no USDC on Tron).
 */
const SUPPORTED_TOKENS_BY_NETWORK: Record<RhinoChainType, TokenName[]> = {
    EVM: ['USDT', 'USDC', 'ETH'],
    SOL: ['USDT', 'USDC'],
    TRON: ['USDT'],
}

/** returns supported tokens (with logos) for a given chain type */
export const getSupportedTokens = (network: RhinoChainType): Array<{ name: TokenName; logoUrl: string }> =>
    SUPPORTED_TOKENS_BY_NETWORK[network].map((name) => ({ name, logoUrl: TOKEN_LOGOS[name] }))

/** Union of every token advertised on at least one network (with logos) — for generic "supported tokens" surfaces */
export const RHINO_SUPPORTED_TOKENS = (Object.keys(TOKEN_LOGOS) as TokenName[])
    .filter((name) => Object.values(SUPPORTED_TOKENS_BY_NETWORK).some((tokens) => tokens.includes(name)))
    .map((name) => ({ name, logoUrl: TOKEN_LOGOS[name] }))

/**
 * EVM numeric chainId → Rhino chain-name mapping. Source of truth: Rhino's
 * `/configs` endpoint response (mirrored in peanut-api-ts `src/rhino/consts.ts`).
 *
 * Includes Arbitrum Sepolia (421614) as an alias for Rhino's ARBITRUM entry
 * — matters for the sandbox harness, where our smart accounts live on Arb
 * Sepolia while Rhino's endpoints only recognize mainnet chain names.
 */
// Values are Rhino's API chain names (what `chainIn`/`chainOut` must be), which
// differ from our display ChainName for two chains: Polygon is `MATIC_POS` and
// BNB Chain is `BINANCE` in Rhino's API. Sending the display name (POLYGON/BNB)
// 400s with `Invalid chain`. Keep this in sync with peanut-api-ts
// `src/rhino/consts.ts` CHAINS_CONFIG.
export const EVM_CHAIN_ID_TO_RHINO_NAME: Record<string, string | undefined> = {
    '1': 'ETHEREUM',
    '10': 'OPTIMISM',
    '56': 'BINANCE', // Rhino's name for BNB Chain (display: BNB)
    '100': 'GNOSIS',
    '137': 'MATIC_POS', // Rhino's name for Polygon (display: POLYGON)
    // SCROLL (534352) removed 2026-07-10: Rhino disabled it ("SCROLL is disabled"
    // InvalidRequest on quote). Re-add only after confirming via getBridgeConfig().
    '42161': 'ARBITRUM',
    '421614': 'ARBITRUM', // Arb Sepolia — same Rhino bucket for sandbox runs
    '8453': 'BASE',
    '42220': 'CELO',
    // Added 2026-07-10 after verifying each against Rhino's live bridge config
    // (status=enabled) AND a real ARBITRUM→X quote + outflow-SDA create.
    // PLASMA/STABLE are USDT-only routes; token gating lives in token-details.json.
    '43114': 'AVALANCHE',
    '999': 'HYPEREVM',
    '57073': 'INK',
    '747474': 'KATANA',
    '59144': 'LINEA',
    '5000': 'MANTLE',
    '9745': 'PLASMA',
    '988': 'STABLE',
    '4217': 'TEMPO',
}

export function evmChainIdToRhinoName(chainId: string | number): string | undefined {
    return EVM_CHAIN_ID_TO_RHINO_NAME[String(chainId)]
}
