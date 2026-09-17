/**
 * How much of a payment request a bank deposit answered.
 *
 * `paidAt` alone is not the whole answer. The backend marks the request paid
 * as soon as a deposit names it, and only closes it when at least the amount
 * asked for arrived — so a request can be paid AND still short. Telling the
 * requester "paid" over a part payment is the one mistake this exists to
 * prevent.
 *
 * A request with no amount asks for whatever the payer sends, so anything that
 * arrives pays it in full.
 */
export type RequestFulfillmentState = 'unpaid' | 'partial' | 'paid'

export function requestFulfillmentState(request: {
    paidAt: string | null
    receivedAmount: string | null
    tokenAmount: string | null
}): RequestFulfillmentState {
    if (!request.paidAt || !request.receivedAmount) return 'unpaid'
    if (!request.tokenAmount) return 'paid'

    const asked = Number(request.tokenAmount)
    const received = Number(request.receivedAmount)
    // An unreadable amount must not read as short: the backend already decided
    // this deposit answered the request, and "partly paid" is a claim about
    // numbers we could not compare.
    if (!Number.isFinite(asked) || !Number.isFinite(received)) return 'paid'

    return received >= asked ? 'paid' : 'partial'
}
