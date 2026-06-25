/**
 * Cross-chain withdrawal fee guard.
 *
 * Rhino's bridge fee is `flat destination gas + 0.07%`, and gas is flat per
 * chain (~$0.01 on L2s, ~$1.50+ on Ethereum mainnet). Because gas is a fixed
 * per-chain cost, a %-of-amount stop naturally blocks tiny mainnet withdrawals
 * (a $10 → mainnet withdraw loses ~15%) while leaving L2s and larger amounts
 * untouched. This is the guard that prevents the "$4 fee on a $5 withdraw"
 * case that originally got the feature disabled.
 */

/** Block the withdrawal when the bridge fee exceeds this share of the amount. */
export const MAX_WITHDRAW_FEE_RATIO = 0.05 // 5%

/**
 * True when the bridge fee is disproportionate to the amount being withdrawn.
 * Returns false for no/zero fee (same-chain, sponsored) or a non-positive
 * amount (nothing to compare against yet).
 */
export function isWithdrawFeeDisproportionate(
    feeUsd: number | undefined,
    amountUsd: number,
    threshold: number = MAX_WITHDRAW_FEE_RATIO
): boolean {
    if (!feeUsd || feeUsd <= 0) return false
    if (!Number.isFinite(amountUsd) || amountUsd <= 0) return false
    return feeUsd / amountUsd > threshold
}
