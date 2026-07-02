'use client'

import InfoCard from '@/components/Global/InfoCard'
import { type TransactionDetails } from '@/components/TransactionDetails/transactionTransformer'
import { extractMerchantIso2 } from '@/components/TransactionDetails/transaction-details.utils'
import { useCardMarkupRate } from '@/hooks/useCardMarkupRate'
import { CARD_FX_MARKUP_BY_CURRENCY } from '@/constants/payment.consts'

/**
 * Countries where Peanut has a first-party local payment rail that's cheaper
 * than spending on the Rain card. A card spend whose merchant sits in one of
 * these countries gets nudged toward the local rail. Add a country here to
 * light up the nudge for it — mirrors MANTECA_GEO_RAIL_MAP in peanut-api-ts.
 *
 * `rail` is the printable, user-facing rail name (reads as "pay with {rail}").
 * `currency` drives the shared `useCardMarkupRate` lookup so this nudge stays
 * in sync with the QR-pay confirm/success surfaces.
 */
export const LOCAL_RAIL_BY_COUNTRY: Record<string, { countryName: string; rail: string; currency: string }> = {
    AR: { countryName: 'Argentina', rail: 'QR', currency: 'ARS' },
    BR: { countryName: 'Brazil', rail: 'Pix', currency: 'BRL' },
}

/**
 * Informational nudge on a card-spend receipt: when the merchant is in a
 * country where Peanut has a cheaper local rail (Argentina → QR, Brazil →
 * Pix), let the user know they could pay a better way next time.
 *
 * Percentage comes from `useCardMarkupRate` so confirm-screen "Save vs card"
 * and this nudge are sourced identically — single number, two surfaces.
 * Static-table fallback is used until the live value resolves to avoid a
 * flash of missing nudge. Loose "around N%" copy stays — this is an
 * educational nudge on a past transaction, not a pre-pay precision moment.
 */
export function LocalRailNudge({ transaction }: { transaction: TransactionDetails }) {
    // Card spends only. Refunds map to a 'receive' card type, so gating on
    // 'card_pay' naturally excludes them — a refund is not a payment choice.
    if (transaction.extraDataForDrawer?.transactionCardType !== 'card_pay') return null

    const iso2 = extractMerchantIso2(transaction.extraDataForDrawer.cardPayment?.merchantCountry)
    const local = iso2 ? LOCAL_RAIL_BY_COUNTRY[iso2.toUpperCase()] : undefined
    if (!local) return null

    return <LocalRailNudgeBody local={local} />
}

function LocalRailNudgeBody({ local }: { local: (typeof LOCAL_RAIL_BY_COUNTRY)[string] }) {
    const { data: cardMarkup } = useCardMarkupRate(local.currency)
    const rate = cardMarkup?.rate ?? CARD_FX_MARKUP_BY_CURRENCY[local.currency]
    const percent = rate && rate > 0 ? Math.round(rate * 100) : null
    if (!percent) return null

    return (
        <InfoCard
            variant="info"
            icon="info"
            title="Pay like a local next time"
            description={`In ${local.countryName}, paying with ${local.rail} costs around ${percent}% less than using your card.`}
        />
    )
}
