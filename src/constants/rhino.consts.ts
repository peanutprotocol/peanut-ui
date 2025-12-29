/** Chain name to logo URL mapping - reusable across the app */
export const CHAIN_LOGOS = {
    ARBITRUM: 'https://assets.coingecko.com/asset_platforms/images/33/standard/AO_logomark.png?1706606717',
    ETHEREUM: 'https://assets.coingecko.com/asset_platforms/images/279/standard/ethereum.png?1706606803',
    BASE: 'https://assets.coingecko.com/asset_platforms/images/131/standard/base.png?1759905869',
    OPTIMISM: 'https://assets.coingecko.com/asset_platforms/images/41/standard/optimism.png?1706606778',
    BNB: 'https://assets.coingecko.com/asset_platforms/images/1/standard/bnb_smart_chain.png?1706606721',
    POLYGON: 'https://assets.coingecko.com/asset_platforms/images/15/standard/polygon_pos.png?1706606645',
    TRON: 'https://assets.coingecko.com/asset_platforms/images/1094/standard/TRON_LOGO.png?1706606652',
    SOLANA: 'https://assets.coingecko.com/asset_platforms/images/5/standard/solana.png?1706606708',
    KATANA: 'https://assets.coingecko.com/asset_platforms/images/32239/standard/katana.jpg?1751496126',
    SCROLL: 'https://assets.coingecko.com/asset_platforms/images/153/standard/scroll.jpeg?1706606782',
    GNOSIS: 'https://assets.coingecko.com/asset_platforms/images/11062/standard/Aatar_green_white.png?1706606458',
    CELO: 'https://assets.coingecko.com/asset_platforms/images/21/standard/celo.jpeg?1711358666',
    MANTLE: 'https://assets.coingecko.com/asset_platforms/images/140/standard/mantle.jpeg?1706606701',
} as const

/** Token symbol to logo URL mapping - reusable across the app */
export const TOKEN_LOGOS = {
    USDT: 'https://assets.coingecko.com/coins/images/325/standard/Tether.png?1696501661',
    USDC: 'https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png',
} as const

export type ChainName = keyof typeof CHAIN_LOGOS
export type TokenName = keyof typeof TOKEN_LOGOS

export const SUPPORTED_EVM_CHAINS = [
    'ARBITRUM',
    'ETHEREUM',
    'BASE',
    'OPTIMISM',
    'BNB',
    'POLYGON',
    'KATANA',
    'SCROLL',
    'GNOSIS',
    'CELO',
    'MANTLE',
] as const

/** Rhino-supported chains with their logos */
export const RHINO_SUPPORTED_CHAINS = (Object.keys(CHAIN_LOGOS) as ChainName[]).map((name) => ({
    name,
    logoUrl: CHAIN_LOGOS[name],
}))

/** Rhino-supported tokens with their logos */
export const RHINO_SUPPORTED_TOKENS = (Object.keys(TOKEN_LOGOS) as TokenName[]).map((name) => ({
    name,
    logoUrl: TOKEN_LOGOS[name],
}))
