import underMaintenanceConfig from '@/config/underMaintenance.config'
import { CHAIN_REGISTRY } from '@/constants/chainRegistry.consts'
import type { TokenMeta } from '@/interfaces/chain-meta'
import { addressFamilyForChainId, isValidAddressForFamily } from '@/lib/validation/addressFamily'

export interface WithdrawDestination {
    address: string
    chainId: string
}

/**
 * Where a destination chosen outside the flow — today a scanned QR code — enters
 * the withdraw flow: the amount step of the crypto rail, marked as arriving from
 * a scan so the flow knows to pick the destination up.
 *
 * The marker is all the URL carries. The address itself is handed over in
 * process (see stashScannedDestination) because a query parameter rides into
 * PostHog's automatic pageviews, session replay and Sentry breadcrumbs, and
 * redactQrTelemetry only scrubs the QR-specific parameter names — so a payout
 * address in the URL would tie "where this person sent their money" to an
 * identified user. The address-book hand-off already works this way.
 */
export const SCAN_ENTRY_PARAM = 'from'
export const SCAN_ENTRY_VALUE = 'scan'
export const WITHDRAW_SCAN_ENTRY_URL = `/withdraw?step=amount&method=crypto&${SCAN_ENTRY_PARAM}=${SCAN_ENTRY_VALUE}`

/**
 * The destination an address and chain name, or null when they name none we can
 * pay out to: the chain has to be one Rhino delivers to, and the address has to
 * be valid for that chain's address family.
 */
export function readWithdrawDestination(
    address: string | null | undefined,
    chainId: string | null | undefined
): WithdrawDestination | null {
    if (!address || !chainId) return null
    // Every destination reaching this contract is on another chain, so the ops
    // kill-switch — which locks withdrawals to USDC on Arbitrum — refuses them all.
    if (underMaintenanceConfig.disableXchainWithdraw) return null
    if (!CHAIN_REGISTRY.some((chain) => chain.id === chainId && chain.withdraw)) return null
    if (!isValidAddressForFamily(address, addressFamilyForChainId(chainId))) return null
    return { address, chainId }
}

let scanned: WithdrawDestination | null = null

/**
 * Offer a scanned destination to the withdraw flow. Returns false — and stores
 * nothing — when it is not one we can pay out to, which is the caller's cue to
 * say so rather than navigate.
 */
export function stashScannedDestination(address: string, chainId: string): boolean {
    const destination = readWithdrawDestination(address, chainId)
    if (!destination) return false
    scanned = destination
    return true
}

/**
 * The last scanned destination. Read, not consumed: React re-invokes state
 * initializers in development, and a one-shot read would hand the second call
 * nothing. Staleness is fenced by {@link SCAN_ENTRY_PARAM} instead — only a
 * navigation that a scan produced asks for this, and that navigation has just
 * overwritten it.
 */
export function readScannedDestination(): WithdrawDestination | null {
    return scanned
}

/**
 * The token a withdrawal to a chosen destination defaults to: USDC where the
 * chain has it, otherwise the chain's only token (Tron delivers USDT and no
 * USDC). Undefined while the chain's token list has not arrived — a
 * destination with no token to send is not one the recipient step can open.
 */
export function withdrawTokenForChain(tokens: readonly TokenMeta[] | undefined): TokenMeta | undefined {
    if (!tokens) return undefined
    return tokens.find((token) => token.symbol.toUpperCase() === 'USDC') ?? tokens[0]
}
