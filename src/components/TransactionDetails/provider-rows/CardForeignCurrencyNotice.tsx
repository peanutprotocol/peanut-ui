'use client'

import InfoCard from '@/components/Global/InfoCard'
import { type TransactionDetails } from '@/components/TransactionDetails/transactionTransformer'
import { extractMerchantIso2 } from '@/components/TransactionDetails/transaction-details.utils'
import { LOCAL_RAIL_BY_COUNTRY } from '@/components/TransactionDetails/provider-rows/LocalRailNudge'

/**
 * Informational notice on a card-spend receipt: the Peanut card settles in
 * USD, so a spend charged in any other currency went through an FX
 * conversion the user didn't pick. Tell them so the USD amount on the
 * receipt isn't a surprise.
 *
 * Sibling to LocalRailNudge — same drawer, same cardPayment data block.
 * Suppressed for countries that already show LocalRailNudge (AR/BR): that
 * nudge carries the stronger "pay a cheaper way" message, and one nudge per
 * receipt is enough.
 */
export function CardForeignCurrencyNotice({ transaction }: { transaction: TransactionDetails }) {
    // Card spends only. Refunds map to a 'receive' card type — same gate as
    // LocalRailNudge, and an FX note on a refund makes no sense.
    if (transaction.extraDataForDrawer?.transactionCardType !== 'card_pay') return null

    const card = transaction.extraDataForDrawer.cardPayment
    const localCurrency = card?.localCurrency?.trim().toUpperCase()
    // Charged in USD (or currency unknown) → no conversion happened, nothing to say.
    if (!localCurrency || localCurrency === 'USD') return null

    // Countries with a local rail already get LocalRailNudge — don't stack.
    const iso2 = extractMerchantIso2(card?.merchantCountry)
    if (iso2 && LOCAL_RAIL_BY_COUNTRY[iso2.toUpperCase()]) return null

    return (
        <InfoCard
            variant="info"
            icon="info"
            title={`Charged in ${localCurrency}`}
            description={`Your Peanut card spends in US dollars, so this purchase was converted from ${localCurrency} at the network exchange rate.`}
        />
    )
}
