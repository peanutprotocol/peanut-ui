import { isFeeFreeRoute, withWalletChain } from '@/components/Global/TokenSelector/TokenSelector.utils'
import { CHAIN_REGISTRY } from '@/constants/chainRegistry.consts'
import { PEANUT_WALLET_CHAIN } from '@/constants/zerodev.consts'
import type { ChainWithTokens } from '@/interfaces/chain-meta'
import type { IToken } from '@/interfaces/interfaces'

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

/**
 * The token a withdrawal sends: its record on the destination chain, when that
 * chain's withdraw list carries it (or it is the free USDC route on the wallet
 * chain). Metadata only, no price (TASK-23850): a withdrawal never waits on a
 * price lookup, and the server books what a non-stable withdrawal delivered.
 */
export function withdrawTokenRecord(
    chains: Record<string, ChainWithTokens>,
    chainId: string,
    tokenAddress: string
): IToken | undefined {
    if (!tokenAddress) return undefined
    const token = withWalletChain(chains)[chainId]?.tokens.find(
        (candidate) => candidate.address.toLowerCase() === tokenAddress.toLowerCase()
    )
    if (!token) return undefined
    if (isFeeFreeRoute(chainId, token.address)) return token
    const withdraw = CHAIN_REGISTRY.find((entry) => entry.id === chainId)?.withdraw
    const isWithdrawable = !!withdraw?.tokens.some((symbol) => symbol.toUpperCase() === token.symbol.toUpperCase())
    return isWithdrawable ? token : undefined
}
