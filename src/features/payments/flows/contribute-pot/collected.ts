/**
 * What a request has collected, in dollars, from both sides of the ledger.
 *
 * The API keeps the two apart: `totalCollectedAmount` is what charges paid — a
 * wallet or a crypto payment — and `receivedAmount` is what arrived by bank
 * transfer. They never overlap. Reading only the first made a request paid in
 * full by bank read "$0 contributed" beside "$30 remaining", on a screen that
 * also said the request was covered.
 *
 * `receivedAmount` reaches the requester alone on some reads. Where it is
 * missing the bank share is absent rather than wrong, which is what the screen
 * showed before this existed.
 */
export function collectedTotal(
    request: { totalCollectedAmount?: number; receivedAmount?: string | null } | null | undefined
) {
    const fromCharges = request?.totalCollectedAmount ?? 0
    const fromBank = Number(request?.receivedAmount ?? 0)
    return fromCharges + (Number.isFinite(fromBank) ? fromBank : 0)
}
