import type { ChainWithTokens } from '@/interfaces/chain-meta'
import { CHAIN_REGISTRY } from '@/constants/chainRegistry.consts'

/**
 * Synthetic selector records for non-EVM withdraw destinations — DERIVED
 * from CHAIN_REGISTRY (`nonEvmRecord` entries). These chains have no
 * chain-details.json entry; the token-selector context merges these records
 * so every selector surface and the price hook resolve them. They stay
 * invisible outside the withdraw flow: every other network list is gated by
 * the wagmi id set, and URL parsing/validation read the server action.
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
