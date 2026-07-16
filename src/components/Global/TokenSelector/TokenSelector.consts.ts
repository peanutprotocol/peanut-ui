import { SOLANA_ICON, TRON_ICON } from '@/assets'
import { networks } from '@/config'
import { CHAIN_REGISTRY } from '@/constants/chainRegistry.consts'
import type { IPeanutChainDetails, IToken } from '@/interfaces/interfaces'
import { celo, linea, scroll, worldchain } from 'viem/chains'

interface CombinedType extends IPeanutChainDetails {
    tokens: IToken[]
}

export interface TokenSelectorProps {
    classNameButton?: string
    shouldBeConnected?: boolean
    showOnlyXchainSupported?: boolean
    onReset?: () => void
}

export interface TokenSelectorXChainProps extends TokenSelectorProps {
    data?: CombinedType[]
    tokenSymbol?: string
    tokenAddress?: string
    chainName?: string
    tokenLogoUrl?: string
    chainLogoUrl?: string
    tokenAmount?: string
    isLoading?: boolean
    routeError?: boolean
    routeFound?: boolean
    onReset?: () => void
    isStatic?: boolean
}

// network configuration for the token selector
export interface NetworkConfig {
    chainId: string
    name: string
    iconUrl: string
}

export const TOKEN_SELECTOR_COMING_SOON_NETWORKS: NetworkConfig[] = [
    {
        chainId: 'solana',
        name: 'Solana',
        iconUrl: SOLANA_ICON,
    },
    {
        chainId: 'tron',
        name: 'Tron',
        iconUrl: TRON_ICON,
    },
]

// popular networks mapping for the token selector — chainId keys lookup into supportedChainsAndTokens for chain metadata
export const TOKEN_SELECTOR_POPULAR_NETWORK_IDS = [
    {
        chainId: '42161',
        name: 'ARB',
    },
    {
        chainId: '1',
        name: 'ETH',
    },
    {
        chainId: '10',
        name: 'OP',
    },
    {
        chainId: '8453',
        name: 'BASE',
    },
]

// scroll excluded 2026-07-10: Rhino disabled it entirely, and Scroll isn't an
// SDA deposit chain either, so every cross-chain route from it dead-ends.
const networksToExclude: readonly number[] = [celo.id, linea.id, scroll.id, worldchain.id] as const

// supported network ids for the network list, getting this from reown appkit config
export const TOKEN_SELECTOR_SUPPORTED_NETWORK_IDS = networks
    .filter((network) => !networksToExclude.includes(Number(network.id)))
    .map((network) => network.id.toString())

/**
 * Rhino-supported withdrawal destinations: chainId → token symbols Rhino can
 * actually deliver. Cross-chain withdraw routes through Rhino (stables via SDA,
 * ETH/native via swaps), and Rhino supports a different, smaller set than the
 * Squid-era token selector — and toggles chains over time (it has Scroll
 * disabled, which 400s `SCROLL is disabled` on preview). Derived from Rhino's
 * live SDA + bridge config (2026-06-26); update when Rhino enables/disables a
 * chain or token.
 *
 * Notes:
 * - Scroll (534352) is intentionally absent — Rhino has it disabled.
 * - Native gas tokens Rhino doesn't bridge are omitted: Polygon (POL) and Gnosis
 *   (xDAI) keep only USDC/USDT; Arbitrum/Ethereum/Optimism native is ETH; BNB on
 *   BNB Chain is supported.
 * - EVM only (the withdraw flow uses 0x addresses); matches the current
 *   selectable chain set rather than every Rhino chain.
 * - 2026-07-10 expansion: each new chain verified against Rhino prod with a real
 *   ARBITRUM→X quote AND an outflow SDA create (see PR #2396). Stablecoins only
 *   for the new chains — that's what was tested. Plasma/Stable are USDT-only on
 *   Rhino. KAIA/opBNB deliberately absent: quotes pass but SDA create rejects
 *   (DepositAddressTokenOutNotSupported).
 */
export const RHINO_WITHDRAW_SUPPORTED_TOKENS_BY_CHAIN: Record<string, readonly string[]> = Object.fromEntries(
    CHAIN_REGISTRY.filter((c) => c.withdraw).map((c) => [c.id, c.withdraw!.tokens])
)
