'use client'

import { Icon } from '@/components/Global/Icons/Icon'
import CurrencySelect from '@/components/LandingPage/CurrencySelect'
import countryCurrencyMappings, { getFlagUrl } from '@/constants/countryCurrencyMapping'
import Image from 'next/image'
import { useTranslations } from 'next-intl'

/**
 * The currency a request is asked in.
 *
 * A payer who pays by bank in this currency is shown the exact amount; every
 * other payer is shown an estimate. The requester's own account currencies lead
 * the list, because those are the ones a payer can pay exactly.
 */
export function RequestCurrencyPicker({
    currency,
    onChange,
    accountCurrencies,
    disabled,
}: {
    currency: string
    onChange: (currency: string) => void
    accountCurrencies: string[]
    disabled?: boolean
}) {
    const t = useTranslations('request')
    const flagCode = countryCurrencyMappings.find((mapping) => mapping.currencyCode === currency)?.flagCode

    return (
        <div className="flex w-full flex-col gap-1">
            <div className="flex w-full items-center justify-between gap-3">
                <span className="text-body-s text-foreground-secondary">{t('currency.label')}</span>
                <CurrencySelect
                    selectedCurrency={currency}
                    setSelectedCurrency={onChange}
                    priorityCurrencies={accountCurrencies}
                    label={t('currency.select')}
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
            </div>
            {currency !== 'USD' && (
                <p className="text-body-s text-foreground-secondary">{t('currency.exactNote', { currency })}</p>
            )}
        </div>
    )
}
