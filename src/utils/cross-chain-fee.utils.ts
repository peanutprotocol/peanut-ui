/**
 * Cross-chain withdrawal fee display and heads-up.
 *
 * The app quotes with Rhino's authenticated (account-bound) quote and shows
 * `feeUsd` verbatim. Rhino prices a withdrawal as flat destination gas plus a
 * share of the amount, but returns a zero fee on part of the traffic — which
 * showed the sponsored label on withdrawals that do carry a fee. A zero quote
 * on the chains with flat gas worth naming falls back to the schedule below.
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
 * Flat destination gas per chain, used when the quote returns zero.
 *
 * Rhino prices these routes, but returns a zero fee on part of the traffic:
 * over the 14 days to 2026-09-16, on 6 of 26 Ethereum quotes, 17 of 38 Tron
 * and 408 of 603 Solana. Those withdrawals showed the sponsored label while
 * the priced ones showed a fee, so the same route read as free or as $1.51
 * depending on the quote.
 *
 * The values are fitted from those priced quotes — the median of
 * `feeUsd - RHINO_FEE_RATE * amount`, whose 50th and 90th percentile agree to
 * the cent on all three chains. Only these three are listed: everywhere else
 * the flat gas is cents and the sponsored label is honest. Re-fit the table
 * when Rhino changes its schedule.
 */
const CHAIN_FLAT_GAS_USD: Record<string, number> = {
    '1': 1.5, // Ethereum mainnet
    solana: 0.5,
    // Tron: the withdraw picker's NON_EVM_WITHDRAW_CHAINS entry uses the
    // 'tron' slug (chainRegistry.consts.ts), not the numeric chain id — key
    // both, as the minimums table below does.
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
