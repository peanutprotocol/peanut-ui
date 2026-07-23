'use client'

import InfoCard from '@/components/Global/InfoCard'
import { type TransactionDetails } from '@/components/TransactionDetails/transactionTransformer'
import { parseCents } from '@/components/TransactionDetails/transaction-details.utils'

/**
 * Notice on a card-spend receipt whose settlement captured MORE than its auth
 * hold. Pairs with the Initial hold / Adjustment breakdown rows in
 * CardPaymentRows: the rows carry the math, this carries the words and the
 * merchant-recourse path. A visible card, not a row tooltip — the recourse
 * sentence is the receipt's only action, and info-icon tooltips go mostly
 * unopened.
 *
 * Fires only for over-captures. Under-captures return money — nothing to
 * warn about; the breakdown rows already show the math. Refunds are excluded
 * like the feed's "Adjusted" flag — a refund clearing at a different amount
 * isn't a merchant overcharge. Copy names example causes ("tips and updated
 * totals") without asserting one — Rain doesn't report why capture ≠ auth.
 */
export function CardAdjustmentNotice({ transaction }: { transaction: TransactionDetails }) {
    const card = transaction.extraDataForDrawer?.cardPayment
    if (!card?.settlementAdjusted || card.isRefund) return null

    const authCents = parseCents(card.authAmount)
    const settledCents = parseCents(card.settledAmount)
    if (authCents == null || settledCents == null) return null

    const deltaCents = settledCents - authCents
    if (deltaCents <= 0) return null

    return (
        <InfoCard
            variant="info"
            icon="info"
            description={`The final amount was $${(deltaCents / 100).toFixed(2)} higher than the initial hold. This is common with tips and updated totals. Don’t recognize it? Contact the merchant.`}
        />
    )
}
