/**
 * Cross-chain withdrawal fee display and heads-up.
 *
 * The app quotes with Rhino's authenticated (account-bound) quote and shows
 * `feeUsd` verbatim wherever it prices the route. Peanut no longer sponsors
 * the fee on Ethereum, Tron and Solana, so a zero quote on those three is
 * priced from the schedule below instead of showing the sponsored label.
 * When the fee is a large share of a small withdrawal we surface a
 * non-blocking heads-up rather than block.
 */

/**
 * The network-fee row value for a quoted transfer. `null` when the user pays
 * nothing on top (same-chain, no quote yet, or a zero quote) — the caller
 * shows the sponsored label; '< $0.01' below a cent; otherwise '$X.XX'.
 */
export function formatNetworkFee(feeUsd: number | undefined, isCrossChain: boolean): string | null {
    if (!isCrossChain || feeUsd === undefined || !Number.isFinite(feeUsd) || feeUsd <= 0) return null
    return feeUsd < 0.01 ? '< $0.01' : `$${feeUsd.toFixed(2)}`
}

/** Surface the heads-up when the bridge fee exceeds this share of the amount. */
export const HIGH_WITHDRAW_FEE_RATIO = 0.05 // 5%

/**
 * True when the bridge fee is a large share of the amount being withdrawn.
 * Returns false for no/zero fee (same-chain, sponsored) or a non-positive
 * amount (nothing to compare against yet).
 */
export function isWithdrawFeeDisproportionate(
    feeUsd: number | undefined,
    amountUsd: number,
    threshold: number = HIGH_WITHDRAW_FEE_RATIO
): boolean {
    if (!feeUsd || feeUsd <= 0) return false
    if (!Number.isFinite(amountUsd) || amountUsd <= 0) return false
    return feeUsd / amountUsd > threshold
}

/** The share of the withdrawal amount Rhino charges on top of the flat gas. */
export const RHINO_FEE_RATE = 0.0007 // 0.07%

/**
 * Flat destination gas per chain, charged on top of RHINO_FEE_RATE.
 *
 * Peanut stops sponsoring the withdrawal fee on these three networks — the
 * expensive ones, where one account's withdrawal loop drove most of a ~$700
 * monthly Rhino bill (Ross Middleton call, 2026-09-16). Rhino enables the
 * charge on their side; from then on the user absorbs it, and a withdrawal of
 * $10 to Ethereum delivers about $8.50.
 *
 * Values are Rhino's schedule, fitted from 14 days of their quotes to
 * 2026-09-16 — the median of `feeUsd - RHINO_FEE_RATE * amount`, whose 50th
 * and 90th percentile agree to the cent on all three chains. Only these three
 * are listed: everywhere else the flat gas is cents and Peanut keeps covering
 * it. Re-fit the table when Rhino changes its schedule.
 *
 * Quotes issued before the charge is enabled come back at zero, so the fee
 * still has to be named from this table; the caller subtracts it from what
 * the recipient receives, which that quote also has not accounted for.
 */
const CHAIN_FLAT_GAS_USD: Record<string, number> = {
    '1': 1.5, // Ethereum mainnet
    solana: 0.5,
    // Tron: the withdraw picker's NON_EVM_WITHDRAW_CHAINS entry uses the
    // 'tron' slug (chainRegistry.consts.ts), not the numeric chain id — key
    // both, so neither representation misses the fee.
    tron: 1.4,
    '728126428': 1.4,
}

/**
 * The scheduled network fee for a withdrawal of this amount to this chain.
 * Null when the chain is not on the schedule, or the amount is not yet a
 * usable number — the caller then keeps whatever the quote said.
 */
export function estimateRhinoNetworkFeeUsd(chainId: string | number, amountUsd: number): number | null {
    const flatGasUsd = CHAIN_FLAT_GAS_USD[String(chainId).toLowerCase()]
    if (flatGasUsd === undefined) return null
    if (!Number.isFinite(amountUsd) || amountUsd <= 0) return null
    return flatGasUsd + RHINO_FEE_RATE * amountUsd
}

/**
 * Rhino per-network withdrawal minimums.
 *
 * Rhino REJECTS a bridge deposit below the route minimum (`UNDER_MIN` webhook)
 * and parks the funds at the deposit address — no auto-refund, recovery is a
 * manual Rhino support action (2026-07-15 incident: $2.50 → Ethereum stuck).
 * So sub-minimum withdrawals must be blocked before funds move. Minimums are
 * USD, uniform across tokens on a chain, and driven by the expensive side of
 * the route: $0.50 everywhere except Ethereum mainnet ($5) and Tron ($10).
 * They apply to RHINO-ROUTED withdrawals only — same-chain (Arbitrum) USDC is
 * a direct transfer with no minimum; callers exempt it before consulting this.
 * Verified against Rhino's getSupportedTokens API on 2026-07-21.
 */
export const MIN_CRYPTO_WITHDRAW_USD = 0.5
export const ETHEREUM_MIN_WITHDRAW_USD = 5

const CHAIN_MIN_WITHDRAW_USD: Record<string, number> = {
    '1': ETHEREUM_MIN_WITHDRAW_USD, // Ethereum mainnet
    // Tron: the withdraw picker's NON_EVM_WITHDRAW_CHAINS entry uses the
    // 'tron' slug (chainRegistry.consts.ts), not the numeric chain id — key
    // both so neither representation slips past the $10 floor.
    tron: 10,
    '728126428': 10,
}

/** Minimum USD amount for a crypto withdrawal to the given destination chain. */
export function getMinWithdrawUsdForChain(chainId: string | number): number {
    return CHAIN_MIN_WITHDRAW_USD[String(chainId)] ?? MIN_CRYPTO_WITHDRAW_USD
}
