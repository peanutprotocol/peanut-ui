/**
 * Cross-chain withdrawal fee heads-up.
 *
 * Rhino's bridge fee is `flat destination gas + 0.07%`, and gas is flat per
 * chain (~$0.01 on L2s, ~$1.50+ on Ethereum mainnet). Because gas is a fixed
 * per-chain cost, a small mainnet withdrawal loses a large share to it (a $10 →
 * mainnet withdraw is ~15%). We don't block it — the fee is shown honestly and
 * the user decides — but we surface a non-blocking heads-up so a tiny mainnet
 * withdrawal isn't a silent footgun. L2s and larger amounts stay below the
 * threshold and show nothing.
 */

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
 * Verified against Rhino's getSupportedTokens API on 2026-07-21.
 */
export const MIN_CRYPTO_WITHDRAW_USD = 0.5
export const ETHEREUM_MIN_WITHDRAW_USD = 5

const CHAIN_MIN_WITHDRAW_USD: Record<string, number> = {
    '1': ETHEREUM_MIN_WITHDRAW_USD, // Ethereum mainnet
    '728126428': 10, // Tron
}

/** Minimum USD amount for a crypto withdrawal to the given destination chain. */
export function getMinWithdrawUsdForChain(chainId: string | number): number {
    return CHAIN_MIN_WITHDRAW_USD[String(chainId)] ?? MIN_CRYPTO_WITHDRAW_USD
}
