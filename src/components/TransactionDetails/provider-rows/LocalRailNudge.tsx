'use client'

import Card from '@/components/Global/Card'
import { Icon } from '@/components/Global/Icons/Icon'
import { type TransactionDetails } from '@/components/TransactionDetails/transactionTransformer'
import { extractMerchantIso2 } from '@/components/TransactionDetails/transaction-details.utils'

/**
 * Countries where Peanut has a first-party local payment rail that's cheaper
 * than spending on the Rain card. A card spend whose merchant sits in one of
 * these countries gets nudged toward the local rail. Add a country here to
 * light up the nudge for it — mirrors MANTECA_GEO_RAIL_MAP in peanut-api-ts.
 *
 * `rail` is the printable, user-facing rail name (reads as "pay with {rail}").
 */
const LOCAL_RAIL_BY_COUNTRY: Record<string, { countryName: string; rail: string }> = {
    AR: { countryName: 'Argentina', rail: 'QR' },
    BR: { countryName: 'Brazil', rail: 'Pix' },
}

/**
 * Informational nudge on a card-spend receipt: when the merchant is in a
 * country where Peanut has a cheaper local rail (Argentina → QR, Brazil →
 * Pix), let the user know they could pay a better way next time.
 *
 * Card spends route through Rain and cost ~9% more than the local rail (see
 * `calculateSavingsInCents` in qr-payment.utils — 9.13% vs card). Renders
 * nothing for any other country or for non-card-spend transactions.
 */
export function LocalRailNudge({ transaction }: { transaction: TransactionDetails }) {
    // Card spends only. Refunds map to a 'receive' card type, so gating on
    // 'card_pay' naturally excludes them — a refund is not a payment choice.
    if (transaction.extraDataForDrawer?.transactionCardType !== 'card_pay') return null

    const iso2 = extractMerchantIso2(transaction.extraDataForDrawer.cardPayment?.merchantCountry)
    const local = iso2 ? LOCAL_RAIL_BY_COUNTRY[iso2.toUpperCase()] : undefined
    if (!local) return null

    return (
        <Card position="single" className="px-4 py-4">
            <div className="flex items-center gap-3">
                <Icon name="info" size={20} className="shrink-0 text-grey-1" />
                <div className="flex flex-col gap-1">
                    <span className="font-semibold text-gray-900">Pay like a local next time</span>
                    <span className="text-sm text-gray-600">
                        In {local.countryName}, paying with {local.rail} costs around 9% less than using your card.
                    </span>
                </div>
            </div>
        </Card>
    )
}
