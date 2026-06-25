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
