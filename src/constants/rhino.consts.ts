import type { RhinoChainType } from '@/services/services.types'
import { CHAIN_REGISTRY, type RegistryChainName } from '@/constants/chainRegistry.consts'

/** Chain name to logo URL mapping — DERIVED from CHAIN_REGISTRY. */
export const CHAIN_LOGOS = Object.fromEntries(
    CHAIN_REGISTRY.filter((c) => c.displayName && c.logoUrl).map((c) => [c.displayName, c.logoUrl])
) as Record<RegistryChainName, string>

/** Token symbol to logo URL mapping - reusable across the app */
export const TOKEN_LOGOS = {
    USDT: 'https://assets.coingecko.com/coins/images/325/standard/Tether.png?1696501661',
    USDC: 'https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png',
    ETH: 'https://assets.coingecko.com/coins/images/279/standard/ethereum.png?1696501628',
} as const

export type ChainName = keyof typeof CHAIN_LOGOS
export type TokenName = keyof typeof TOKEN_LOGOS

// DERIVED from CHAIN_REGISTRY: EVM chains with a deposit surface. Mirrors
// Rhino's live SDA config — a deposit on an unsupported chain is silently
// lost, so registry entries only get `deposit` after verifying the catalog.
export const SUPPORTED_EVM_CHAINS = CHAIN_REGISTRY.filter((c) => c.family === 'evm' && c.deposit).map(
    (c) => c.displayName as RegistryChainName
)

// DERIVED from CHAIN_REGISTRY: non-EVM deposit chains.
export const OTHER_SUPPORTED_CHAINS = CHAIN_REGISTRY.filter((c) => c.family !== 'evm' && c.deposit).map(
    (c) => c.displayName as RegistryChainName
)

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

/**
 * EVM deposit chains where Rhino accepts FEWER tokens than the EVM family
 * list above. A token sent on a chain where Rhino doesn't accept it is
 * silently lost (no webhook, no intent), so deposit surfaces annotate these.
 * Source: Rhino's live SDA catalog (getSupportedConfigs, 2026-07-11).
 */
export const EVM_DEPOSIT_TOKEN_EXCEPTIONS: Partial<Record<ChainName, TokenName[]>> = Object.fromEntries(
    CHAIN_REGISTRY.filter((c) => c.family === 'evm' && c.deposit?.tokens).map((c) => [
        c.displayName,
        [...(c.deposit!.tokens as readonly TokenName[])],
    ])
)

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
// DERIVED from CHAIN_REGISTRY: every EVM entry with a live Rhino name,
// including aliases (Arb Sepolia → ARBITRUM for the sandbox harness).
// Rhino-disabled chains (SCROLL) have no rhinoName and drop out naturally.
export const EVM_CHAIN_ID_TO_RHINO_NAME: Record<string, string | undefined> = Object.fromEntries(
    CHAIN_REGISTRY.filter((c) => c.family === 'evm' && c.rhinoName).flatMap((c) =>
        [c.id, ...(c.aliasIds ?? [])].map((id) => [id, c.rhinoName])
    )
)

export function evmChainIdToRhinoName(chainId: string | number): string | undefined {
    return EVM_CHAIN_ID_TO_RHINO_NAME[String(chainId)]
}

/**
 * Non-EVM withdraw destinations use string slugs as their selector chainId
 * ('solana' | 'tron' — the identifiers the old coming-soon entries used).
 * Chain data lives in `nonEvmWithdraw.consts.ts`.
 */
export const NON_EVM_CHAIN_ID_TO_RHINO_NAME: Record<string, string | undefined> = Object.fromEntries(
    CHAIN_REGISTRY.filter((c) => c.family !== 'evm' && c.rhinoName).map((c) => [c.id, c.rhinoName])
)

/** chainId (EVM numeric or non-EVM slug) → Rhino API chain name. */
export function chainIdToRhinoName(chainId: string | number): string | undefined {
    const key = String(chainId)
    return EVM_CHAIN_ID_TO_RHINO_NAME[key] ?? NON_EVM_CHAIN_ID_TO_RHINO_NAME[key.toLowerCase()]
}
