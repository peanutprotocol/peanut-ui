'use client'

import InfoCard from '@/components/Global/InfoCard'
import { type TransactionDetails } from '@/components/TransactionDetails/transactionTransformer'
import { extractMerchantIso2 } from '@/components/TransactionDetails/transaction-details.utils'
import { LOCAL_RAIL_BY_COUNTRY } from '@/components/TransactionDetails/provider-rows/local-rail-countries'

/**
 * Countries whose local currency IS the US dollar — a USD card charge there is
 * normal, not the dynamic-currency-conversion (DCC) trap. Covers the US, its
 * territories, and the sovereign USD-users. Keep small; a missing entry only
 * means one extra (harmless) nudge, never a wrong charge.
 */
const USD_COUNTRIES = new Set(['US', 'PR', 'GU', 'VI', 'AS', 'MP', 'EC', 'SV', 'PA', 'TL', 'BQ'])

/**
 * Informational notice on a card-spend receipt for the DCC trap: when a
 * merchant abroad bills the card in USD (the terminal's "pay in dollars?"
 * option), the user gets the terminal's markup instead of Peanut's better
 * rate. Tell them to pick the local currency next time.
 *
 * Fires only when the merchant BILLED in USD (`localCurrency === 'USD'`) AND
 * the merchant sits in a non-USD country. A spend already billed in the local
 * currency is the good outcome — no notice. Suppressed in AR/BR where
 * LocalRailNudge already carries the stronger "pay with the local rail"
 * message — one nudge per receipt.
 */
export function CardUsdAbroadNotice({ transaction }: { transaction: TransactionDetails }) {
    // Card spends only. Refunds map to a 'receive' card type — same gate as
    // LocalRailNudge, and this advice makes no sense on a refund.
    if (transaction.extraDataForDrawer?.transactionCardType !== 'card_pay') return null

    const card = transaction.extraDataForDrawer.cardPayment
    // Only the DCC case: the merchant billed in USD. A non-USD billing currency
    // means they already paid local (the good outcome) — nothing to say.
    if (card?.localCurrency?.trim().toUpperCase() !== 'USD') return null

    const iso2 = extractMerchantIso2(card?.merchantCountry)?.toUpperCase()
    // Need a known country to tell it's abroad; a USD country is a normal
    // domestic USD charge, not DCC.
    if (!iso2 || USD_COUNTRIES.has(iso2)) return null

    // Countries with a local rail already get LocalRailNudge — don't stack.
    if (LOCAL_RAIL_BY_COUNTRY[iso2]) return null

    return (
        <InfoCard
            variant="info"
            icon="info"
            title="Pay in local currency next time"
            description="You were charged in US dollars. When a terminal offers to bill in dollars, choose the local currency instead — Peanut's exchange rate is usually better."
        />
    )
}
