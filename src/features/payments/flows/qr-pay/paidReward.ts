import type { QrPayment } from '@/services/manteca'
import type { PixPayment } from '@/services/pix'

/** A QR payment's reward, in the shape the success view shows it (Manteca's QR completion's `perk`). */
export type QrPerk = NonNullable<QrPayment['perk']>

/** The paid payment the success view celebrates: its id, who was paid, and the reward it earned. */
export interface PaidReward {
    paymentId: string
    merchantName?: string
    perk: QrPerk | null
}

/**
 * The QR reward a payment on the Pix pay routes earned (API-CONTRACT-M5 §3): the read's `perk`, which
 * has Manteca's shape with the sponsored amount named `sponsoredUsd`. Only a paid payment carries one;
 * a refunded or cancelled one shows none, whatever the read says.
 */
export function pixPaidPerk(payment: Pick<PixPayment, 'state' | 'perk'> | undefined): QrPerk | null {
    if (payment?.state !== 'paid' || !payment.perk) return null
    const { eligible, discountPercentage, claimed, sponsoredUsd, txHash, usageId, payoutStatus } = payment.perk
    return { eligible, discountPercentage, claimed, amountSponsored: sponsoredUsd, txHash, usageId, payoutStatus }
}
