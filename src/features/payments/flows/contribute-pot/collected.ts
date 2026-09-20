/**
 * What a request has collected, in dollars, from both sides of the ledger.
 *
 * The API keeps the two apart: `totalCollectedAmount` is what charges paid — a
 * wallet or a crypto payment — and `receivedAmount` is what arrived by bank
 * transfer. They never overlap. Reading only the first made a request paid in
 * full by bank read "$0 contributed" beside "$30 remaining", on a screen that
 * also said the request was covered.
 *
 * `receivedAmount` reaches the REQUESTER alone: it is how much money somebody
 * has, so the payer's read of the same request does not carry it. That read
 * gets the figure from the other end instead — what the request still needs,
 * which `/pay-amounts` publishes to every payer because nobody can pay the
 * right amount without it.
 */
export function collectedTotal(
    request:
        | { totalCollectedAmount?: number; receivedAmount?: string | null; tokenAmount?: string | null }
        | null
        | undefined,
    /** dollars left to pay, as the API states them — see `usdRemainingOf` */
    usdRemaining?: number
) {
    const fromCharges = request?.totalCollectedAmount ?? 0
    if (request?.receivedAmount !== undefined && request?.receivedAmount !== null) {
        const fromBank = Number(request.receivedAmount)
        return fromCharges + (Number.isFinite(fromBank) ? fromBank : 0)
    }

    // The payer's read. `asked − left` counts every payment the API counted,
    // charges included, so it is never below the charge total — and where it
    // somehow is, the charges the payer can see win rather than a figure that
    // would shrink the progress bar.
    const asked = Number(request?.tokenAmount)
    if (usdRemaining !== undefined && Number.isFinite(usdRemaining) && Number.isFinite(asked)) {
        return Math.max(asked - usdRemaining, fromCharges)
    }
    return fromCharges
}

/**
 * The dollars a request still needs, off a `/pay-amounts` answer.
 *
 * The Peanut rail is always dollars and always exact — `tokenAmount` less
 * everything collected — which makes it the one figure both the progress
 * header and the bank rows can be built from. An answer without that rail
 * states no remainder, which is not the same as a remainder of zero.
 */
export function usdRemainingOf(
    payAmounts: { rails: { kind: string; payerAmount: { amount?: string | null } }[] } | undefined
): number | undefined {
    const raw = payAmounts?.rails.find((rail) => rail.kind === 'peanut_balance')?.payerAmount.amount
    if (raw === undefined || raw === null) return undefined
    const value = Number(raw)
    return Number.isFinite(value) ? value : undefined
}
