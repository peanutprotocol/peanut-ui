'use client'

import { useLocale, useTranslations } from 'next-intl'
import GlobalCard from '@/components/Global/Card'
import { PaymentInfoRow } from '@/components/Payment/PaymentInfoRow'
import { formatBankAmount, formatFiatRate } from '@/utils/currency'

/**
 * The provider's exchange rate and fee on a Pix deposit (`pixRateAndFee`), with the labels and rows
 * of the payment details card: "Exchange rate 1 USD = 5.80 BRL", "Provider fee R$0.75". `rate`
 * null waits for the quote; `providerFeeBrl` null shows no fee row (a quote of the minimum names
 * no fee of the user's).
 */
export function PixRateAndFeeCard({ rate, providerFeeBrl }: { rate: number | null; providerFeeBrl: string | null }) {
    const tCommon = useTranslations('common')
    const locale = useLocale()
    const tPix = useTranslations('pix.withdraw')
    return (
        <GlobalCard className="px-4">
            <PaymentInfoRow
                label={tCommon('exchangeRate')}
                value={rate !== null ? `1 USD = ${formatFiatRate(rate, locale)} BRL` : ''}
                loading={rate === null}
                hideBottomBorder={providerFeeBrl === null}
            />
            {providerFeeBrl !== null && (
                <PaymentInfoRow
                    label={tPix('fee')}
                    value={formatBankAmount(providerFeeBrl, 'BRL', locale)}
                    hideBottomBorder
                />
            )}
        </GlobalCard>
    )
}
