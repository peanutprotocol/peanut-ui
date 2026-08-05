/**
 * THE chain registry — single source of truth for every chain fact the FE
 * hand-maintains about Rhino-connected chains.
 *
 * Before this file, one chain's facts were spread across SEVEN maps
 * (CHAIN_LOGOS, SUPPORTED_EVM_CHAINS, EVM_CHAIN_ID_TO_RHINO_NAME,
 * RHINO_WITHDRAW_SUPPORTED_TOKENS_BY_CHAIN, EVM_DEPOSIT_TOKEN_EXCEPTIONS,
 * CHAIN_ROLLOUT_FLAGS, NON_EVM_WITHDRAW_CHAINS) — the drift between them
 * caused the SCROLL rot and the frozen-SDA incident. Those exports still
 * exist at their old import paths, but every one of them is now DERIVED
 * from this registry (see the `derive*` helpers below + the equality tests
 * in __tests__/chainRegistry.test.ts).
 *
 * To add/change a chain: edit ONE entry here. Verify against Rhino's live
 * catalogs first (`getBridgeConfig()` for withdraw, `getSupportedConfigs()`
 * for deposit) — the monitor's drift check compares this registry to Rhino.
 *
 * NOT in scope: chain-details.json / token-details.json (chain metadata for
 * generic EVM surfaces — explorer URLs, full token lists) and the BE's
 * CHAINS_CONFIG (already a single map in peanut-api-ts).
 */

export interface RegistryTokenMeta {
    symbol: string
    address: string
    decimals: number
    name: string
    logoURI: string
}

export interface ChainRegistryEntry {
    /** Selector identifier: EVM numeric chainId as a string, or a non-EVM slug. */
    id: string
    /** Additional selector ids resolving to the same Rhino bucket (e.g. Arb Sepolia → ARBITRUM). */
    aliasIds?: readonly string[]
    /** Rhino API chain name. Absent = Rhino has the chain disabled (kept for display only). */
    rhinoName?: string
    family: 'evm' | 'solana' | 'tron'
    /** Display key on deposit surfaces (the legacy `ChainName`). */
    displayName?: string
    logoUrl?: string
    /** Present = advertised DEPOSIT chain. `tokens` only when narrower than
     *  the family default (USDT/USDC/ETH for EVM) — drives the "USDT only"
     *  funds-safety annotations. */
    deposit?: { tokens?: readonly string[] }
    /** Present = Rhino WITHDRAW destination; `tokens` = symbols Rhino
     *  delivers there (each verified: live quote + outflow SDA create). */
    withdraw?: { tokens: readonly string[] }
    /** Synthetic selector record for non-EVM chains (no chain-details entry). */
    nonEvmRecord?: { networkName: string; tokens: readonly RegistryTokenMeta[] }
    /** PostHog rollout gate — see engineering/patterns/feature-gates.md.
     *  Delete when the chain launch is permanent. */
    rolloutFlag?: string
}

const TOKEN_LOGO = {
    USDT: 'https://assets.coingecko.com/coins/images/325/standard/Tether.png?1696501661',
    USDC: 'https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png',
} as const

const CHAIN_REGISTRY_LITERAL = [
    // ── legacy, always-on chains ────────────────────────────────────────────
    {
        id: '42161',
        aliasIds: ['421614'], // Arb Sepolia — same Rhino bucket for sandbox runs
        rhinoName: 'ARBITRUM',
        family: 'evm',
        displayName: 'ARBITRUM',
        logoUrl: 'https://assets.coingecko.com/asset_platforms/images/33/standard/AO_logomark.png?1706606717',
        deposit: {},
        withdraw: { tokens: ['ETH', 'USDC', 'USDT'] },
    },
    {
        id: '1',
        rhinoName: 'ETHEREUM',
        family: 'evm',
        displayName: 'ETHEREUM',
        logoUrl: 'https://assets.coingecko.com/asset_platforms/images/279/standard/ethereum.png?1706606803',
        deposit: {},
        withdraw: { tokens: ['ETH', 'USDC', 'USDT'] },
    },
    {
        id: '8453',
        rhinoName: 'BASE',
        family: 'evm',
        displayName: 'BASE',
        logoUrl: 'https://assets.coingecko.com/asset_platforms/images/131/standard/base.png?1759905869',
        deposit: {},
        // Enabled 2026-07-13 (Hugo): Base was missing from the curated
        // withdraw gate since June — an oversight, not a decision. Verified
        // same-day: ARB→BASE quotes OK for ETH/USDC/USDT + outflow SDA
        // create OK. Rollout-flagged like the other 2026-07 additions.
        withdraw: { tokens: ['ETH', 'USDC', 'USDT'] },
        rolloutFlag: 'chain-rollout-base',
    },
    {
        id: '10',
        rhinoName: 'OPTIMISM',
        family: 'evm',
        displayName: 'OPTIMISM',
        logoUrl: 'https://assets.coingecko.com/asset_platforms/images/41/standard/optimism.png?1706606778',
        deposit: {},
        withdraw: { tokens: ['ETH', 'USDC', 'USDT'] },
    },
    {
        id: '100',
        rhinoName: 'GNOSIS',
        family: 'evm',
        displayName: 'GNOSIS',
        logoUrl: 'https://assets.coingecko.com/asset_platforms/images/11062/standard/Aatar_green_white.png?1706606458',
        deposit: { tokens: ['USDT', 'USDC'] }, // no ETH on Gnosis at Rhino
        withdraw: { tokens: ['USDC', 'USDT'] }, // native xDAI not bridged by Rhino
    },
    {
        id: '137',
        rhinoName: 'MATIC_POS', // Rhino's name for Polygon (display: POLYGON)
        family: 'evm',
        displayName: 'POLYGON',
        logoUrl: 'https://assets.coingecko.com/asset_platforms/images/15/standard/polygon_pos.png?1706606645',
        deposit: {},
        withdraw: { tokens: ['USDC', 'USDT'] }, // native POL not bridged by Rhino
    },
    {
        id: '56',
        rhinoName: 'BINANCE', // Rhino's name for BNB Chain (display: BNB)
        family: 'evm',
        displayName: 'BNB',
        logoUrl: 'https://assets.coingecko.com/asset_platforms/images/1/standard/bnb_smart_chain.png?1706606721',
        deposit: {},
        withdraw: { tokens: ['BNB', 'USDC', 'USDT'] },
    },
    {
        id: '42220',
        rhinoName: 'CELO',
        family: 'evm',
        displayName: 'CELO',
        logoUrl: 'https://assets.coingecko.com/asset_platforms/images/21/standard/celo.jpeg?1711358666',
        deposit: { tokens: ['USDT', 'USDC'] }, // no ETH on Celo at Rhino
        // not a withdraw destination in the curated gate (legacy state)
    },
    {
        // SCROLL: display-only legacy — Rhino disabled it 2026-07 ("SCROLL is
        // disabled" InvalidRequest). No rhinoName = not routable anywhere.
        id: '534352',
        family: 'evm',
        displayName: 'SCROLL',
        logoUrl: 'https://assets.coingecko.com/asset_platforms/images/153/standard/scroll.jpeg?1706606782',
    },

    // ── 2026-07 expansion (peanut-ui#2396/#2398) — each verified against ──
    // ── Rhino prod: live quote + outflow SDA create; rollout-flagged ──────
    {
        id: '43114',
        rhinoName: 'AVALANCHE',
        family: 'evm',
        withdraw: { tokens: ['USDC', 'USDT'] },
        rolloutFlag: 'chain-rollout-avalanche',
    },
    {
        id: '999',
        rhinoName: 'HYPEREVM',
        family: 'evm',
        withdraw: { tokens: ['USDC', 'USDT'] },
        rolloutFlag: 'chain-rollout-hyperevm',
    },
    {
        id: '57073',
        rhinoName: 'INK',
        family: 'evm',
        withdraw: { tokens: ['USDC', 'USDT'] },
        rolloutFlag: 'chain-rollout-ink',
    },
    {
        id: '747474',
        rhinoName: 'KATANA',
        family: 'evm',
        displayName: 'KATANA',
        logoUrl: 'https://assets.coingecko.com/asset_platforms/images/32239/standard/katana.jpg?1751496126',
        deposit: {},
        withdraw: { tokens: ['USDC', 'USDT'] }, // delivered as vbUSDC/vbUSDT
        rolloutFlag: 'chain-rollout-katana',
    },
    {
        id: '59144',
        rhinoName: 'LINEA',
        family: 'evm',
        withdraw: { tokens: ['USDC', 'USDT'] },
        rolloutFlag: 'chain-rollout-linea',
    },
    {
        id: '5000',
        rhinoName: 'MANTLE',
        family: 'evm',
        withdraw: { tokens: ['USDC', 'USDT'] }, // USDT delivered as USDT0
        rolloutFlag: 'chain-rollout-mantle',
    },
    {
        id: '9745',
        rhinoName: 'PLASMA',
        family: 'evm',
        displayName: 'PLASMA',
        logoUrl: 'https://coin-images.coingecko.com/asset_platforms/images/32256/small/plasma.jpg?1758000963',
        deposit: { tokens: ['USDT'] }, // USDT0-only chain — USDC would be lost
        withdraw: { tokens: ['USDT'] },
        rolloutFlag: 'chain-rollout-plasma',
    },
    {
        id: '988',
        rhinoName: 'STABLE',
        family: 'evm',
        withdraw: { tokens: ['USDT'] }, // USDT0-only chain
        rolloutFlag: 'chain-rollout-stable',
    },
    {
        id: '4217',
        rhinoName: 'TEMPO',
        family: 'evm',
        displayName: 'TEMPO',
        logoUrl: 'https://icons.llamao.fi/icons/chains/rsz_tempo.jpg',
        deposit: { tokens: ['USDT', 'USDC'] }, // no ETH asset on Tempo
        withdraw: { tokens: ['USDC', 'USDT'] }, // delivered as USDC.e/USDT0
        rolloutFlag: 'chain-rollout-tempo',
    },
    {
        id: '8217',
        rhinoName: 'KAIA',
        family: 'evm',
        displayName: 'KAIA',
        logoUrl: 'https://coin-images.coingecko.com/asset_platforms/images/9672/small/kaia.png?1734946776',
        deposit: { tokens: ['USDT'] }, // USDT-only at Rhino — USDC would be lost
        // NOT a withdraw destination: Rhino SDA create rejects Kaia tokenOut
        rolloutFlag: 'chain-rollout-kaia',
    },

    // ── non-EVM ─────────────────────────────────────────────────────────────
    {
        id: 'solana',
        rhinoName: 'SOLANA',
        family: 'solana',
        displayName: 'SOLANA',
        logoUrl: 'https://assets.coingecko.com/asset_platforms/images/5/standard/solana.png?1706606708',
        deposit: {}, // SOL family default (USDT/USDC)
        withdraw: { tokens: ['USDC', 'USDT'] },
        nonEvmRecord: {
            networkName: 'Solana',
            tokens: [
                {
                    symbol: 'USDC',
                    address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
                    decimals: 6,
                    name: 'USD Coin',
                    logoURI: TOKEN_LOGO.USDC,
                },
                {
                    symbol: 'USDT',
                    address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
                    decimals: 6,
                    name: 'Tether USD',
                    logoURI: TOKEN_LOGO.USDT,
                },
            ],
        },
        rolloutFlag: 'chain-rollout-solana',
    },
    {
        id: 'tron',
        rhinoName: 'TRON',
        family: 'tron',
        displayName: 'TRON',
        logoUrl: 'https://assets.coingecko.com/asset_platforms/images/1094/standard/TRON_LOGO.png?1706606652',
        deposit: {}, // TRON family default (USDT)
        withdraw: { tokens: ['USDT'] }, // no USDC on Tron
        nonEvmRecord: {
            networkName: 'Tron',
            tokens: [
                {
                    symbol: 'USDT',
                    address: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
                    decimals: 6,
                    name: 'Tether USD',
                    logoURI: TOKEN_LOGO.USDT,
                },
            ],
        },
        rolloutFlag: 'chain-rollout-tron',
    },
] as const satisfies readonly ChainRegistryEntry[]

/** Display-name union (the legacy `ChainName`) — literal types preserved
 *  via Extract (indexed access fails on union members lacking the prop). */
type RegistryEntryLiteral = (typeof CHAIN_REGISTRY_LITERAL)[number]
export type RegistryChainName = Extract<RegistryEntryLiteral, { displayName: string }>['displayName']

/** The registry, widened for iteration (optional props accessible on every
 *  entry). The literal source above keeps the name union type-safe. */
export const CHAIN_REGISTRY: readonly ChainRegistryEntry[] = CHAIN_REGISTRY_LITERAL

// ─── Derived views ─────────────────────────────────────────────────────────
// Everything below is COMPUTED from the registry — never hand-edit a chain
// fact here; edit the entry above.

import type { ChainWithTokens } from '@/interfaces/chain-meta'

/**
 * Per-chain PostHog rollout flags, keyed by every identifier a chain appears
 * under (selector id, aliases, deposit display name) so one flag governs all
 * surfaces of the same chain. See engineering/patterns/feature-gates.md.
 */
export const CHAIN_ROLLOUT_FLAGS: Record<string, string> = Object.fromEntries(
    CHAIN_REGISTRY.filter((c) => c.rolloutFlag).flatMap((c) =>
        [c.id, ...(c.aliasIds ?? []), ...(c.displayName ? [c.displayName] : [])].map((key) => [key, c.rolloutFlag!])
    )
)

/**
 * Synthetic selector records for non-EVM withdraw destinations (no
 * chain-details.json entry). The token-selector context merges these so
 * every selector surface and the price hook resolve them; they stay
 * invisible outside the withdraw flow (all other network lists are gated by
 * the wagmi id set, and URL parsing/validation read the server action).
 */
export const NON_EVM_WITHDRAW_CHAINS: Record<string, ChainWithTokens> = Object.fromEntries(
    CHAIN_REGISTRY.filter((c) => c.nonEvmRecord).map((c) => [
        c.id,
        {
            chainId: c.id,
            networkName: c.nonEvmRecord!.networkName,
            chainIconURI: c.logoUrl ?? '',
            tokens: c.nonEvmRecord!.tokens.map((t) => ({
                chainId: c.id,
                address: t.address,
                decimals: t.decimals,
                name: t.name,
                symbol: t.symbol,
                logoURI: t.logoURI,
                usdPrice: 0,
            })),
        },
    ])
)

export function isNonEvmWithdrawChainId(chainId: string | number): boolean {
    return Object.prototype.hasOwnProperty.call(NON_EVM_WITHDRAW_CHAINS, String(chainId).toLowerCase())
}
