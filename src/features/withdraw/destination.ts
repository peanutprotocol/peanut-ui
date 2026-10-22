import underMaintenanceConfig from '@/config/underMaintenance.config'
import { CHAIN_REGISTRY } from '@/constants/chainRegistry.consts'
import type { TokenMeta } from '@/interfaces/chain-meta'
import { addressFamilyForChainId, isValidAddressForFamily } from '@/lib/validation/addressFamily'

export interface WithdrawDestination {
    address: string
    /** Undefined for an EVM address that names no network: one address is valid on every EVM chain. */
    chainId?: string
    /** The ENS name the address was resolved from, shown beside it. */
    name?: string
    /** The token a payment request (EIP-681) asks for, by symbol. */
    tokenSymbol?: string
    /** The user has to pick the network before the withdrawal can continue. */
    networkPending: boolean
}

/** What a scan knows beyond the address and its chain. */
type ScannedDestinationDetails = Pick<WithdrawDestination, 'name' | 'tokenSymbol'>

/** A payment request's token and amount, the amount in token units. */
interface ScannedPaymentRequest {
    tokenSymbol?: string
    amount?: string
}

const USD_STABLECOINS = ['USDC', 'USDT']

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

/**
 * The URL a scan enters the flow by. A payment request's amount comes along
 * only in a dollar stablecoin: the amount step takes USD, so any other token's
 * amount would be read as dollars. An amount is not a payout address, so it can
 * ride in the URL like any amount the user types.
 */
export function withdrawScanEntryUrl(scanId: string, request: ScannedPaymentRequest = {}): string {
    const url = `/withdraw?step=amount&method=crypto&${SCAN_ID_PARAM}=${encodeURIComponent(scanId)}`
    const { tokenSymbol, amount } = request
    if (!amount || !USD_STABLECOINS.includes(tokenSymbol?.toUpperCase() ?? '')) return url
    return `${url}&amount=${encodeURIComponent(amount)}`
}

/**
 * The destination an address and chain name, or null when they name none we can
 * pay out to: the chain has to be one Rhino delivers to, and the address has to
 * be valid for that chain's address family. With no chain, the address has to
 * be an EVM one, and the user picks its network in the flow.
 */
export function readWithdrawDestination(
    address: string | null | undefined,
    chainId?: string | null
): WithdrawDestination | null {
    if (!address) return null
    if (!chainId) {
        if (!isValidAddressForFamily(address, 'evm')) return null
        // The ops kill-switch locks withdrawals to USDC on Arbitrum and disables
        // the network pick, so a pending network could never be confirmed.
        // Arbitrum is the same chain, which the lock allows, so the address is
        // accepted with nothing to pick.
        return { address, networkPending: !underMaintenanceConfig.disableXchainWithdraw }
    }
    // A destination that names its chain keeps that chain and the token it
    // asks for. The kill-switch would move it to USDC on Arbitrum, so it
    // refuses them all instead.
    if (underMaintenanceConfig.disableXchainWithdraw) return null
    if (!CHAIN_REGISTRY.some((chain) => chain.id === chainId && chain.withdraw)) return null
    if (!isValidAddressForFamily(address, addressFamilyForChainId(chainId))) return null
    return { address, chainId, networkPending: false }
}

let scanned: (WithdrawDestination & { id: string }) | null = null
let scanCount = 0

/**
 * Offer a scanned destination to the withdraw flow. Returns the id to put in the
 * entry URL, or null — storing nothing — when it is not one we can pay out to,
 * which is the caller's cue to say so rather than navigate.
 */
export function stashScannedDestination(
    address: string,
    chainId?: string,
    details: ScannedDestinationDetails = {}
): string | null {
    const destination = readWithdrawDestination(address, chainId)
    if (!destination) return null
    scanned = { ...destination, ...details, id: `scan-${++scanCount}` }
    return scanned.id
}

/**
 * The destination that scan handed over, consumed. Only the scan named by `id`
 * gets one, so a URL left over from an earlier scan hands out nothing, and
 * pressing on twice cannot re-apply a destination the user has moved past.
 */
export function takeScannedDestination(id: string | null | undefined): WithdrawDestination | null {
    if (!id || scanned?.id !== id) return null
    const { id: _id, ...destination } = scanned
    scanned = null
    return destination
}

/** Drop a pending hand-off — the user has chosen a destination by hand instead. */
export function clearScannedDestination(): void {
    scanned = null
}

/**
 * The token a withdrawal to a chosen destination defaults to: the one a payment
 * request asks for when the chain has it, then USDC where the chain has it,
 * otherwise the chain's only token (Tron delivers USDT and no USDC). Undefined
 * while the chain's token list has not arrived — a destination with no token
 * to send is not one the recipient step can open.
 */
export function withdrawTokenForChain(
    tokens: readonly TokenMeta[] | undefined,
    requestedSymbol?: string
): TokenMeta | undefined {
    if (!tokens) return undefined
    const bySymbol = (symbol: string) => tokens.find((token) => token.symbol.toUpperCase() === symbol.toUpperCase())
    return (requestedSymbol ? bySymbol(requestedSymbol) : undefined) ?? bySymbol('USDC') ?? tokens[0]
}
