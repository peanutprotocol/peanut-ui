'use client'

import type { ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import GlobalCard from '@/components/Global/Card'
import { PaymentInfoRow } from '@/components/Payment/PaymentInfoRow'
import { ProviderHelp } from '@/components/Provider/ProviderHelp'
import { PROVIDERS } from '@/constants/providers.consts'
import type { ProviderId } from '@/types/provider.types'
import { formatFiniteDisplay } from '@/utils/currency'

/**
 * The details card of a payment form, one row per fact the user pays by. The
 * same card for the Pix-key payment and the Pix withdrawal (ruling
 * 2026-11-12, providers are cattle); each flow passes the rows it has:
 *
 * - Exchange rate (i): always.
 * - Savings vs card (i): the payment, when the card markup gives a saving.
 * - Peanut fee: always "Sponsored by Peanut!" (zero on both flows).
 * - Provider fee: when the quote carries a flat fee; hidden when it does not
 *   (Manteca charges none).
 * - Bank receives / Total: the withdrawal, the exact reais and the exact
 *   wallet debit its quote names; each row waits while the quote is in flight.
 * - Provider (?): when the route names one.
 */
export function PaymentDetailsCard({
    rate,
    savings,
    providerFee,
    payout,
    total,
    providerId,
}: {
    /** The local currency per USD, as the quote gives it, and the currency's code; null while no quote is in hand. */
    rate: { price: number; code: string } | null
    /** The USD saved against a foreign card, formatted, with the currency the comparison is for. */
    savings?: { usd: string; currencyCode: string } | null
    /** The provider's flat fee, formatted ("R$0.75"); null or undefined shows no row. */
    providerFee?: string | null
    /** The exact local amount the quote pays out ("R$503"), where it was not typed; null waits for the quote, left out shows no row. */
    payout?: string | null
    /** The exact wallet debit the quote names ("$92.50"); null waits for the quote, left out shows no row. */
    total?: string | null
    providerId: ProviderId | null
}) {
    const t = useTranslations('qrPay')
    const tCommon = useTranslations('common')
    const tProvider = useTranslations('provider')
    const tPix = useTranslations('pix.withdraw')
    const tWithdraw = useTranslations('withdraw')

    const rows: Array<{ key: string; label: ReactNode; value: ReactNode; moreInfoText?: string; loading?: boolean }> = [
        {
            key: 'rate',
            label: t('info.exchangeRate'),
            value: rate
                ? `1 USD = ${formatFiniteDisplay(rate.price, 'en-US', { maximumFractionDigits: 20, useGrouping: false })} ${rate.code.toUpperCase()}`
                : '',
            moreInfoText: tCommon('exchangeRateInfo'),
        },
    ]
    if (savings) {
        rows.push({
            key: 'savings',
            label: t('info.saveVsCard'),
            value: `~$${savings.usd}`,
            moreInfoText:
                savings.currencyCode.toUpperCase() === 'BRL'
                    ? t('info.saveVsCardTooltipBrl')
                    : t('info.saveVsCardTooltipArs'),
        })
    }
    rows.push({ key: 'peanut-fee', label: tCommon('peanutFee'), value: tCommon('sponsoredByPeanut') })
    if (providerFee) rows.push({ key: 'provider-fee', label: tPix('fee'), value: providerFee })
    if (payout !== undefined)
        rows.push({
            key: 'payout',
            label: tWithdraw('bank.bankReceives'),
            value: payout ?? '',
            loading: payout === null,
        })
    if (total !== undefined)
        rows.push({ key: 'total', label: tWithdraw('confirm.youPay'), value: total ?? '', loading: total === null })
    if (providerId) {
        rows.push({
            key: 'provider',
            label: (
                <span className="flex items-center gap-1">
                    {tProvider('label.provider')}
                    <ProviderHelp providerId={providerId} />
                </span>
            ),
            value: PROVIDERS[providerId].brand,
        })
    }

    return (
        <GlobalCard className="px-4">
            {rows.map((row, index) => (
                <PaymentInfoRow
                    key={row.key}
                    label={row.label}
                    value={row.value}
                    moreInfoText={row.moreInfoText}
                    loading={row.loading}
                    hideBottomBorder={index === rows.length - 1}
                />
            ))}
        </GlobalCard>
    )
}
