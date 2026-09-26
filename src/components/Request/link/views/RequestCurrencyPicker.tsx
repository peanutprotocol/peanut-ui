'use client'

import { DataRow } from '@/components/0_Bruddle/DataRow'
import { Icon } from '@/components/Global/Icons/Icon'
import CurrencySelect from '@/components/LandingPage/CurrencySelect'
import countryCurrencyMappings, { getFlagUrl } from '@/constants/countryCurrencyMapping'
import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'

/**
 * The currency a request is asked in.
 *
 * A payer who pays by bank in this currency is shown the exact amount; every
 * other payer is shown an estimate. The requester's own account currencies lead
 * the list, because those are the ones a payer can pay exactly.
 *
 * That note holds only while the request shares bank details. Without them the
 * payer is never offered a bank transfer, so an exact-amount promise about one
 * describes a method that is not on their screen.
 */
export function RequestCurrencyPicker({
    currency,
    onChange,
    accountCurrencies,
    bankPayable,
    disabled,
}: {
    currency: string
    onChange: (currency: string) => void
    accountCurrencies: string[]
    /** whether this request shares bank details, so a payer can send a transfer */
    bankPayable: boolean
    disabled?: boolean
}) {
    const t = useTranslations('request')
    const locale = useLocale()
    const flagCode = countryCurrencyMappings.find((mapping) => mapping.currencyCode === currency)?.flagCode

    return (
        <div className="flex w-full flex-col gap-1">
            {/* the DS label/value row; the row itself is not a control, only
                the currency trigger in its value slot is */}
            <DataRow
                label={t('currency.label')}
                value={
                    <CurrencySelect
                        selectedCurrency={currency}
                        setSelectedCurrency={onChange}
                        priorityCurrencies={accountCurrencies}
                        label={t('currency.select')}
                        locale={locale}
                        trigger={
                            <button
                                type="button"
                                disabled={disabled}
                                aria-label={t('currency.triggerLabel', { currency })}
                                className="flex min-h-11 items-center gap-2 text-body-m-semibold text-foreground-primary focus-visible:outline-[3px] focus-visible:outline-action-focus disabled:text-foreground-secondary"
                            >
                                {flagCode && (
                                    <Image
                                        src={getFlagUrl(flagCode)}
                                        alt=""
                                        width={160}
                                        height={160}
                                        className="size-4 rounded-full object-cover"
                                    />
                                )}
                                {currency}
                                <Icon name="chevron-down" className="text-foreground-secondary" size={16} />
                            </button>
                        }
                    />
                }
            />
            {currency !== 'USD' && bankPayable && (
                <p className="text-body-s text-foreground-secondary">{t('currency.exactNote', { currency })}</p>
            )}
        </div>
    )
}
