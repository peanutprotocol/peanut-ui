/**
 * One place for the "which message renders under the amount input" rule, for
 * every flow that has an amount step.
 *
 * TASK-21666: on crypto withdraws the limits card never renders, and the
 * balance error used to be suppressed while the limits validation was
 * blocking — above the off-ramp limit the user got a dead Continue with no
 * message at all. The rule: the flow-error message yields to the limits card
 * only when that card actually renders.
 */
export function shouldShowAmountError({
    showError,
    showsLimitsCard,
    limitsBlocking,
}: {
    showError: boolean
    /** This flow renders the limits card, so the card may replace the message. */
    showsLimitsCard: boolean
    limitsBlocking: boolean
}): boolean {
    if (!showError) return false
    return !showsLimitsCard || !limitsBlocking
}
