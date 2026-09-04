/**
 * One place for the "which message renders under the amount input" rule.
 *
 * TASK-21666: on crypto withdraws the limits card never renders, and the
 * balance error used to be suppressed while the limits validation was
 * blocking — above the off-ramp limit the user got a dead Continue with no
 * message at all. The rule: the flow-error banner yields to the limits card
 * only when that card actually renders.
 */
export function shouldShowAmountError({
    showError,
    isCryptoWithdraw,
    limitsBlocking,
}: {
    showError: boolean
    isCryptoWithdraw: boolean
    limitsBlocking: boolean
}): boolean {
    if (!showError) return false
    // The limits card renders for fiat withdrawals only — it may replace the
    // banner there. For crypto there is no card, so the banner must never hide.
    return isCryptoWithdraw || !limitsBlocking
}
