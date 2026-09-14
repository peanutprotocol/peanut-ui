/**
 * Cross-chain withdrawal fee display and heads-up.
 *
 * The app quotes with Rhino's authenticated (account-bound) quote, and
 * Peanut's account is configured 1:1 with no on-chain fee on stablecoin
 * routes — so `feeUsd` is normally 0 and the row shows the sponsored label.
 * Rhino can still deduct a small network cost on delivery (1–3 bps seen on
 * Solana) and the account config can change, so everything here reads the
 * quote verbatim and never assumes zero: a non-zero quote is shown as-is, and
 * when it is a large share of a small withdrawal we surface a non-blocking
 * heads-up rather than block.
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
