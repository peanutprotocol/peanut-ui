import { getKillSwitches } from '@/features/kill-switches/kill-switches-store'
import { CHAIN_REGISTRY } from '@/constants/chainRegistry.consts'
import type { TokenMeta } from '@/interfaces/chain-meta'
import { addressFamilyForChainId, isValidAddressForFamily } from '@/lib/validation/addressFamily'

export interface WithdrawDestination {
    address: string
    /** Undefined for an EVM address that names no network: one address is valid on every EVM chain. */
    chainId?: string
    /** The ENS name the address was resolved from, shown beside it. */
    name?: string
    /** The token a payment request (EIP-681) asks for, by symbol: one the chain pays out. */
    tokenSymbol?: string
    /** The exact contract that request names: several contracts can share a symbol. */
    tokenAddress?: string
}

/** What a scan knows beyond the address and its chain. */
type ScannedDestinationDetails = Pick<WithdrawDestination, 'name' | 'tokenSymbol' | 'tokenAddress'>

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
 * be an EVM one, and the user picks its network on the pay screen. The token a
 * payment request asks for has to be one Rhino delivers to that chain.
 */
export function readWithdrawDestination(
    address: string | null | undefined,
    chainId?: string | null,
    tokenSymbol?: string
): WithdrawDestination | null {
    if (!address) return null
    if (!chainId) {
        // A requested token cannot be checked against a chain nobody named.
        if (tokenSymbol) return null
        if (!isValidAddressForFamily(address, 'evm')) return null
        return { address }
    }
    // A destination that names its chain keeps that chain and the token it
    // asks for. The kill-switch would move it to USDC on Arbitrum, so it
    // refuses them all instead.
    if (getKillSwitches().disableXchainWithdraw) return null
    const withdraw = CHAIN_REGISTRY.find((entry) => entry.id === chainId)?.withdraw
    if (!withdraw) return null
    // A payment request is paid in the token it asks for or not at all, so the
    // token has to be one Rhino delivers to that chain. A fallback to USDC would
    // change the asset behind the user's back.
    if (tokenSymbol && !withdraw.tokens.some((symbol) => symbol.toUpperCase() === tokenSymbol.toUpperCase())) {
        return null
    }
    if (!isValidAddressForFamily(address, addressFamilyForChainId(chainId))) return null
    return { address, chainId, tokenSymbol }
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
    const destination = readWithdrawDestination(address, chainId, details.tokenSymbol)
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
 * The token a withdrawal to a chosen destination defaults to: USDC where the
 * chain has it, otherwise the chain's only token (Tron delivers USDT and no
 * USDC). The token a payment request asks for is taken as asked or not at all:
 * by the exact contract when the request names one, else by symbol, and never
 * another asset in its place. Undefined while the chain's token list has not
 * arrived — a destination with no token to send is not one the recipient step
 * can open.
 */
export function withdrawTokenForChain(
    tokens: readonly TokenMeta[] | undefined,
    requested: { symbol?: string; address?: string } = {}
): TokenMeta | undefined {
    if (!tokens) return undefined
    const { symbol, address } = requested
    const bySymbol = (wanted: string) => tokens.find((token) => token.symbol.toUpperCase() === wanted.toUpperCase())
    if (address) return tokens.find((token) => token.address.toLowerCase() === address.toLowerCase())
    if (symbol) return bySymbol(symbol)
    return bySymbol('USDC') ?? tokens[0]
}

/**
 * The token an EIP-681 payment request may be paid in on its chain, or undefined
 * when the request has to be refused. A request names its asset through an
 * ERC-20 transfer (a contract) or a native value (the chain's native token,
 * which the parser names by symbol). The withdrawal selects a token by symbol,
 * and several contracts can share one (Optimism lists two USDC), so an ERC-20
 * request has to name the contract that selection yields. Any other contract
 * would be paid with a different one in its place.
 */
export function withdrawTokenForRequest(
    tokens: readonly TokenMeta[] | undefined,
    request: { tokenSymbol?: string; tokenAddress?: string }
): TokenMeta | undefined {
    if (!request.tokenSymbol) return undefined
    const token = withdrawTokenForChain(tokens, { symbol: request.tokenSymbol })
    if (!token) return undefined
    if (request.tokenAddress && token.address.toLowerCase() !== request.tokenAddress.toLowerCase()) return undefined
    return token
}
