/** Route builders for the withdraw flow's cross-route navigations. */

import underMaintenanceConfig from '@/config/underMaintenance.config'
import { CHAIN_REGISTRY } from '@/constants/chainRegistry.consts'
import { addressFamilyForChainId, isValidAddressForFamily } from '@/lib/validation/addressFamily'

/**
 * /withdraw/manteca with its query contract (method, country, amount,
 * destination, isSavedAccount). Undefined/empty values are omitted.
 */
export function mantecaWithdrawUrl(params: Record<string, string | undefined>): string {
    const search = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
        if (value) search.set(key, value)
    }
    const qs = search.toString()
    return qs ? `/withdraw/manteca?${qs}` : '/withdraw/manteca'
}

/**
 * A withdrawal destination the user chose outside the flow — today a scanned
 * QR code — reaches /withdraw as `?destination=<address>&chain=<chainId>`,
 * next to the `method=crypto` marker that skips method selection and the
 * `step=amount` that lands on the amount screen.
 */
export function withdrawDestinationUrl(address: string, chainId: string): string {
    const params = new URLSearchParams({ step: 'amount', method: 'crypto', destination: address, chain: chainId })
    return `/withdraw?${params.toString()}`
}

/**
 * The destination those two params name, or null when they name none we can
 * pay out to. Nothing here is trusted: the pair arrives in a URL the user can
 * edit, so the chain has to be one Rhino delivers to and the address has to be
 * valid for that chain's address family. Per-chain rollout is the caller's
 * check — that one needs the PostHog hook.
 */
export function readWithdrawDestination(
    address: string | null | undefined,
    chainId: string | null | undefined
): { address: string; chainId: string } | null {
    if (!address || !chainId) return null
    // Every destination reaching this contract is on another chain, so the ops
    // kill-switch — which locks withdrawals to USDC on Arbitrum — refuses them all.
    if (underMaintenanceConfig.disableXchainWithdraw) return null
    if (!CHAIN_REGISTRY.some((chain) => chain.id === chainId && chain.withdraw)) return null
    if (!isValidAddressForFamily(address, addressFamilyForChainId(chainId))) return null
    return { address, chainId }
}
