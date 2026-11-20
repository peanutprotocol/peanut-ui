'use client'

import { Callout } from '@/components/0_Bruddle/Callout'
import { type TransactionDetails } from '@/components/TransactionDetails/transactionTransformer'
import { extractMerchantIso2 } from '@/components/TransactionDetails/transaction-details.utils'
import { LOCAL_RAIL_BY_COUNTRY } from '@/components/TransactionDetails/provider-rows/local-rail-countries'
import { useCardMarkupRate } from '@/hooks/useCardMarkupRate'
import { CARD_FX_MARKUP_BY_CURRENCY } from '@/constants/payment.consts'
import { hasCardMarkupComparison } from '@/utils/qr-payment.utils'
import { localizedCountryName } from '@/utils/country-name.utils'
import { useLocale, useTranslations } from 'next-intl'

/**
 * Informational nudge on a card-spend receipt: when the merchant is in a
 * country where Peanut has a local rail (Argentina → QR, Brazil → Pix), let
 * the user know they could pay that way next time.
 *
 * Only a currency with a card comparison (ARS) gets a percentage. Brazil gets
 * the callout without a number: a BRL purchase costs about the same on the
 * card and on Pix (mono `product/pricing.md`, row B-4).
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

    const iso2 = extractMerchantIso2(transaction.extraDataForDrawer.cardPayment?.merchantCountry)?.toUpperCase()
    const local = iso2 ? LOCAL_RAIL_BY_COUNTRY[iso2] : undefined
    if (!iso2 || !local) return null

    return <LocalRailNudgeBody iso2={iso2} local={local} />
}

function LocalRailNudgeBody({ iso2, local }: { iso2: string; local: (typeof LOCAL_RAIL_BY_COUNTRY)[string] }) {
    const t = useTranslations('transaction')
    const locale = useLocale()
    const compares = hasCardMarkupComparison(local.currency)
    // No currency means no request: a backend that still publishes a BRL
    // figure must not put it on screen.
    const { data: cardMarkup } = useCardMarkupRate(compares ? local.currency : undefined)
    const country = localizedCountryName(locale, iso2, local.countryName)

    if (!compares) {
        return (
            <Callout priority="info" title={t('nudge.localRailTitle')}>
                {t('nudge.localRailAvailableDescription', { iso2, country, rail: local.rail })}
            </Callout>
        )
    }

    // `null` means the backend published no comparison, so show none. Only a
    // still-loading `undefined` falls back to the documented assumption.
    const rate = cardMarkup === undefined ? CARD_FX_MARKUP_BY_CURRENCY[local.currency] : cardMarkup?.rate
    const percent = rate && rate > 0 ? Math.round(rate * 100) : null
    if (!percent) return null

    return (
        <Callout priority="info" title={t('nudge.localRailTitle')}>
            {t('nudge.localRailDescription', {
                iso2,
                country,
                rail: local.rail,
                percent,
            })}
        </Callout>
    )
}
