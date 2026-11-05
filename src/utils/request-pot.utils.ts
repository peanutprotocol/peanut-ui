import { formatUnits } from 'viem'
import { type ChargeEntry } from '@/services/services.types'

/** A request charge as the receipt, the payer page and the success screen each read it. */
type ContributionCharge = Pick<ChargeEntry, 'tokenAmount' | 'payments' | 'settledAmount' | 'partialPayment'> & {
    /** Absent on the history rollup's charges, which carry no decimals. */
    tokenDecimals?: number | null
}

/**
 * What one charge put into a request, as a decimal string in the request's token.
 *
 * A charge's `tokenAmount` is what its payer asked to pay, and a payment can
 * arrive short of it (a crypto deposit of 33 USDC into a $58.51 charge). The
 * rows used to print the asked amount, so they summed to more than the
 * collected total beside them (TASK-23856).
 *
 * The API's `settledAmount` wins. Before it ships, the SUCCESSFUL payments'
 * settled figures are summed, which needs the token's decimals. Without
 * either, the asked amount is all there is.
 */
export function contributedAmount(charge: ContributionCharge): string {
    if (charge.settledAmount !== undefined && charge.settledAmount !== null) return charge.settledAmount

    const successful = (charge.payments ?? []).filter((payment) => payment.status === 'SUCCESSFUL')
    const decimals = charge.tokenDecimals
    // `every`, as in the history rollup sum: one payment with no settled figure
    // makes the whole charge fall back, so a missing leg never reads as 0.
    const allSettled = successful.every(
        (payment) => payment.paidAmountInRequestedToken !== undefined && payment.paidAmountInRequestedToken !== null
    )
    if (successful.length > 0 && allSettled && typeof decimals === 'number') {
        try {
            const settled = successful.reduce((sum, payment) => sum + BigInt(payment.paidAmountInRequestedToken!), 0n)
            return formatUnits(settled, decimals)
        } catch {
            // a malformed figure falls back to the asked amount below
        }
    }
    return charge.tokenAmount
}

/** The API flags a charge paid short of its own amount; absent means not partial. */
export function isPartialContribution(charge: Pick<ContributionCharge, 'partialPayment'>): boolean {
    return charge.partialPayment === true
}
