import type { IPeanutChainDetails, IPeanutTokenDetail } from '@/interfaces/interfaces'
import chainDetailsJson from '@/constants/chain-details.json'
import tokenDetailsJson from '@/constants/token-details.json'
import { mainnet, arbitrum, arbitrumSepolia, polygon, optimism, base, bsc, scroll } from 'viem/chains'

const CHAIN_DETAILS = chainDetailsJson as unknown as Record<string, IPeanutChainDetails>
const TOKEN_DETAILS = tokenDetailsJson as unknown as IPeanutTokenDetail[]

// Verified 2026-05-13 with curl from staging.peanut.me origin.
// Commented entries are kept inline for visibility — re-enable when fixed.
//
// COMMENTED OUT (broken from browser):
//   • Infura + Alchemy: NEXT_PUBLIC_* keys exposed in bundle, free-tier
//     quota burned by every visitor (429s); Alchemy's origin allowlist
//     also excludes staging.peanut.me (CORS). Re-enable only after moving
//     the keys server-side behind /api/rpc/[chainId]. The infuraUrl /
//     alchemyUrl builders that used to live here were removed (no callers
//     after the comment-out); /api/health/rpc reads the env vars directly.
//   • eth.public-rpc.com: returns 403 to OPTIONS preflight.
//   • rpc.ankr.com/*: now requires an API key ("Unauthorized" -32000).
//   • polygon-rpc.com: "API key disabled, tenant disabled" (401).
//
// All other URLs verified working with proper CORS for staging.peanut.me.
export const rpcUrls: Record<number, string[]> = {
    [mainnet.id]: [
        'https://ethereum-mainnet.core.chainstack.com/006d2d45e7727fb2d5ff46ffc19a2958', // Chainstack (primary)
        // infuraUrl('mainnet'),
        // alchemyUrl('eth-mainnet'),
        // 'https://eth.public-rpc.com', // 403 preflight
        'https://ethereum.publicnode.com', // Public fallback
        // 'https://rpc.ankr.com/eth', // requires API key
    ].filter(Boolean) as string[],
    [arbitrum.id]: [
        'https://arbitrum-mainnet.core.chainstack.com/78d8b6bbaa8ae6d8ce2546c13b619288', // Chainstack (primary)
        // infuraUrl('arbitrum-mainnet'),
        // alchemyUrl('arb-mainnet'),
        'https://arb1.arbitrum.io/rpc', // Official public RPC
        'https://arbitrum.publicnode.com', // Public fallback
        // 'https://rpc.ankr.com/arbitrum', // requires API key
    ].filter(Boolean) as string[],
    [arbitrumSepolia.id]: [
        'https://arbitrum-sepolia.publicnode.com', // publicnode (primary) — keyless, CORS *, reliable
        'https://arbitrum-sepolia.drpc.org', // drpc — keyless fallback
        'https://sepolia-rollup.arbitrum.io/rpc', // Official Arbitrum Sepolia (503-prone) — last resort
    ].filter(Boolean) as string[],
    [polygon.id]: [
        'https://polygon-mainnet.core.chainstack.com/e8d733c7341e28d98e4cf66c61c42aa6', // Chainstack (primary)
        // infuraUrl('polygon-mainnet'),
        // alchemyUrl('polygon-mainnet'),
        // 'https://polygon-rpc.com', // tenant disabled (401)
        'https://polygon-bor-rpc.publicnode.com', // Public fallback
        // 'https://rpc.ankr.com/polygon', // requires API key
    ].filter(Boolean) as string[],
    [optimism.id]: [
        // infuraUrl('optimism-mainnet'),
        // alchemyUrl('opt-mainnet'),
        'https://mainnet.optimism.io', // Official Optimism RPC
    ].filter(Boolean) as string[],
    [base.id]: [
        'https://base-mainnet.core.chainstack.com/01f0761d79d1b6e9d234d7ab69a90b19', // Chainstack (primary)
        // infuraUrl('base-mainnet'),
        // alchemyUrl('base-mainnet'),
        'https://mainnet.base.org', // Official Base RPC
    ].filter(Boolean) as string[],
    [bsc.id]: [
        'https://bsc-mainnet.core.chainstack.com/2d9b1537fa4555562f8e15fd08bf8ed5', // Chainstack (primary)
        'https://bsc-dataseed.bnbchain.org', // Official BSC RPC
        // infuraUrl('bsc-mainnet'),
        // alchemyUrl('bsc-mainnet'),
        'https://bsc.publicnode.com', // Public fallback
    ].filter(Boolean) as string[],
    [scroll.id]: [
        // infuraUrl('scroll-mainnet'),
        'https://rpc.scroll.io', // Official Scroll RPC
    ].filter(Boolean) as string[],
}

export const PEANUT_API_URL = (
    process.env.PEANUT_API_URL ||
    process.env.NEXT_PUBLIC_PEANUT_API_URL ||
    'https://api.peanut.me'
).replace(/\/$/, '') // remove any accidental trailing slash

export const PEANUT_API_KEY = process.env.PEANUT_API_KEY!

export const IS_DEV = process.env.NODE_ENV === 'development'
export const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://peanut.me'
// URL for the frontend to call its own Next.js API routes (like /api/health/*)
export const SELF_URL = IS_DEV ? 'http://localhost:3000' : BASE_URL
// Git commit hash - injected at build time
export const GIT_COMMIT_HASH = process.env.NEXT_PUBLIC_GIT_COMMIT_HASH || 'unknown'
// Check if we're in production (not dev or using production URL)
export const IS_PRODUCTION = !IS_DEV || BASE_URL === 'https://peanut.me'

export const supportedMobulaChains = <{ name: string; chainId: string }[]>[
    {
        name: 'Fantom',
        chainId: '250',
    },
    {
        name: 'Avalanche C-Chain',
        chainId: '43114',
    },
    {
        name: 'Cronos',
        chainId: '25',
    },
    {
        name: 'DFK Subnet',
        chainId: '53935',
    },
    {
        name: 'Ethereum',
        chainId: '1',
    },
    {
        name: 'SmartBCH',
        chainId: '10000',
    },
    {
        name: 'Polygon',
        chainId: '137',
    },
    {
        name: 'BNB Smart Chain (BEP20)',
        chainId: '56',
    },
    {
        name: 'Celo',
        chainId: '42220',
    },
    {
        name: 'XDAI',
        chainId: '100',
    },
    {
        name: 'Klaytn',
        chainId: '8217',
    },
    {
        name: 'Aurora',
        chainId: '1313161554',
    },
    {
        name: 'HECO',
        chainId: '128',
    },
    {
        name: 'Harmony',
        chainId: '1666600000',
    },
    {
        name: 'Boba',
        chainId: '288',
    },
    {
        name: 'OKEX',
        chainId: '66',
    },
    {
        name: 'Moonriver',
        chainId: '1285',
    },
    {
        name: 'Moonbeam',
        chainId: '1284',
    },
    {
        name: 'BitTorrent Chain',
        chainId: '199',
    },
    {
        name: 'Oasis',
        chainId: '42262',
    },
    {
        name: 'Velas',
        chainId: '106',
    },
    {
        name: 'Arbitrum',
        chainId: '42161',
    },
    {
        name: 'Optimistic',
        chainId: '10',
    },
    {
        name: 'Kucoin',
        chainId: '321',
    },
    {
        name: 'Base',
        chainId: '8453',
    },
    {
        name: 'Shibarium',
        chainId: '109',
    },
    {
        name: 'Mantle',
        chainId: '5000',
    },
    {
        name: 'Sui',
        chainId: 'sui',
    },
    {
        name: 'ZetaChain',
        chainId: '7000',
    },
    {
        name: 'Alephium',
        chainId: 'alephium-0',
    },
    {
        name: 'Scroll',
        chainId: '534352',
    },
]

export const supportedPeanutChains: IPeanutChainDetails[] = Object.keys(CHAIN_DETAILS).map(
    (key) => CHAIN_DETAILS[key as keyof typeof CHAIN_DETAILS]
)

export const peanutTokenDetails: IPeanutTokenDetail[] = TOKEN_DETAILS

export const nativeCurrencyAddresses: string[] = [
    '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    '0x0000000000000000000000000000000000000000',
]

export const STABLE_COINS = ['USDC', 'USDT', 'DAI', 'BUSD']

export const ROUTE_NOT_FOUND_ERROR =
    'No route found for this token pair. You can try with a different token pair, or contact support.'

// Perk claim UI constants
export const PERK_HOLD_DURATION_MS = 1500 // 1.5 seconds hold duration for claiming perks

export const ENS_NAME_REGEX = /^(?:[-a-zA-Z0-9]+\.)+[-a-zA-Z0-9]+$/

// Mirrors the backend username minimum (USERNAME_REGEX = /^[a-z][a-z0-9]{3,11}$/).
export const USERNAME_MIN_LENGTH = 4
