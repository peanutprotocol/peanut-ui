import { SOLANA_ICON, TRON_ICON } from '@/assets'
import { networks } from '@/config'
import type { IPeanutChainDetails, IToken } from '@/interfaces/interfaces'
import { celo, linea, worldchain } from 'viem/chains'

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

const networksToExclude: readonly number[] = [celo.id, linea.id, worldchain.id] as const

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
 * - Gnosis (100) is omitted: our token data only has native xDAI for it (no
 *   USDC/USDT), so it has nothing offerable even though Rhino supports stables.
 * - Native gas tokens Rhino doesn't bridge are omitted: Polygon (POL) keeps only
 *   USDC/USDT; Arbitrum/Ethereum/Optimism native is ETH; BNB on BNB Chain is supported.
 * - EVM only (the withdraw flow uses 0x addresses); matches the current
 *   selectable chain set rather than every Rhino chain.
 */
export const RHINO_WITHDRAW_SUPPORTED_TOKENS_BY_CHAIN: Record<string, readonly string[]> = {
    '42161': ['ETH', 'USDC', 'USDT'], // Arbitrum
    '1': ['ETH', 'USDC', 'USDT'], // Ethereum
    '10': ['ETH', 'USDC', 'USDT'], // Optimism
    '137': ['USDC', 'USDT'], // Polygon (native POL not bridged by Rhino)
    '56': ['BNB', 'USDC', 'USDT'], // BNB Chain
}
