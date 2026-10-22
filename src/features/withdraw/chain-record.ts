import { PEANUT_WALLET_CHAIN } from '@/constants/zerodev.consts'
import type { ChainWithTokens } from '@/interfaces/chain-meta'

/**
 * The record of the network a withdrawal goes to. The record already holds the
 * synthetic non-EVM destinations (merged once in tokenSelector.context), but it
 * may not list the Peanut wallet chain on testnets or env-configured chains: a
 * minimal entry stands in so the same-chain (no-bridge) path can proceed.
 */
export function withdrawChainRecord(
    chains: Record<string, ChainWithTokens>,
    chainId: string
): ChainWithTokens | undefined {
    const record = chains[chainId]
    if (record) return record
    if (chainId !== PEANUT_WALLET_CHAIN.id.toString()) return undefined
    return { chainId, networkName: PEANUT_WALLET_CHAIN.name, chainIconURI: '', tokens: [] }
}
