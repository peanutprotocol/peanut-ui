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
 * the withdraw flow: the amount step of the crypto rail, carrying the id of the
 * scan that sent the user there.
 *
 * The id is all the URL carries. The address itself is handed over in process
 * (see {@link stashScannedDestination}) because a query parameter rides into
 * PostHog's automatic pageviews, session replay and Sentry breadcrumbs, and
 * redactQrTelemetry only scrubs the QR-specific parameter names — so a payout
 * address in the URL would tie "where this person sent their money" to an
 * identified user. The address-book hand-off already works this way.
 *
 * It is an id rather than a bare marker because /withdraw keeps its layout
 * mounted: a second scan from that page navigates without remounting, so a
 * value that never changes would leave the flow holding the first destination.
 */
export const SCAN_ID_PARAM = 'scan'

export function withdrawScanEntryUrl(scanId: string): string {
    return `/withdraw?step=amount&method=crypto&${SCAN_ID_PARAM}=${encodeURIComponent(scanId)}`
}

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

let scanned: (WithdrawDestination & { id: string }) | null = null
let scanCount = 0

/**
 * Offer a scanned destination to the withdraw flow. Returns the id to put in the
 * entry URL, or null — storing nothing — when it is not one we can pay out to,
 * which is the caller's cue to say so rather than navigate.
 */
export function stashScannedDestination(address: string, chainId: string): string | null {
    const destination = readWithdrawDestination(address, chainId)
    if (!destination) return null
    scanned = { ...destination, id: `scan-${++scanCount}` }
    return scanned.id
}

/**
 * The destination that scan handed over, consumed. Only the scan named by `id`
 * gets one, so a URL left over from an earlier scan hands out nothing, and
 * pressing on twice cannot re-apply a destination the user has moved past.
 */
export function takeScannedDestination(id: string | null | undefined): WithdrawDestination | null {
    if (!id || scanned?.id !== id) return null
    const { address, chainId } = scanned
    scanned = null
    return { address, chainId }
}

/** Drop a pending hand-off — the user has chosen a destination by hand instead. */
export function clearScannedDestination(): void {
    scanned = null
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
