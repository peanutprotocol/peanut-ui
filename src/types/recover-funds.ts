import type { IUserBalance } from '@/interfaces/interfaces'

/** A token recover funds reads a balance for. */
export interface RecoverableToken {
    address: string
    symbol: string
    name: string
    decimals: number
    logoURI: string
}

/**
 * A balance recover funds can move. `rawAmount` is the exact on-chain amount in
 * base units, so a transfer moves all of it; `amount` is for display only.
 */
export interface RecoverableBalance extends IUserBalance {
    rawAmount: bigint
}

/** One entry of Rhino's public token list (`/bridge/bridge-swap-token-configs`). */
export interface RhinoTokenConfig {
    tokenAddress: string
    symbol: string
    name: string
    decimals: number
    iconUrl?: string
}

/** Rhino's token list, keyed by Rhino chain name (ARBITRUM, ETHEREUM, BASE, LINEA…). */
export type RhinoTokenConfigs = Record<string, RhinoTokenConfig[]>
