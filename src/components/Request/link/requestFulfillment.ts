import type { BankFulfilment } from '@/services/services.types'

/**
 * How much of a payment request a bank deposit answered.
 *
 * The backend owns this answer and returns it as `bankFulfilment`. A bank
 * transfer loses fees on the way and lands as a converted amount, so "did the
 * requested amount arrive" is a question about tolerance, not about equality —
 * and the tolerance belongs where the deposit is booked, not on a screen.
 *
 * The comparison below is the fallback for a response from before the field
 * existed. It reads short of the asked amount as a part payment, which is what
 * this file was written for: telling the requester "paid" over a part payment
 * is the one mistake to prevent. A request with no amount asks for whatever the
 * payer sends, so anything that arrives pays it in full.
 */
export type RequestFulfillmentState = 'unpaid' | 'partial' | 'paid'

export function requestFulfillmentState(request: {
    bankFulfilment?: BankFulfilment | null
    paidAt: string | null
    receivedAmount: string | null
    tokenAmount: string | null
}): RequestFulfillmentState {
    if (request.bankFulfilment) return request.bankFulfilment === 'none' ? 'unpaid' : request.bankFulfilment

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
