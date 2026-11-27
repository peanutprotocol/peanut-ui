'use client'

import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import { ListGroup } from '@/components/0_Bruddle/ListGroup'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { getCurrencyFlagUrl } from '@/constants/countryCurrencyMapping'
import type { SupportedExchangeCurrency } from '@/constants/exchange-currencies.consts'
import { formatAmountNumber } from '@/utils/currency'
import type { FxBulkRateEntry } from '@/utils/fx.utils'
import { getOrderedCurrencies, RATE_DECIMALS } from './rates-fees.utils'

interface AllCurrenciesViewProps {
    rates: Record<string, FxBulkRateEntry> | undefined
    userCountryCode?: string | null
    loading?: boolean
    onSelectCurrency: (currency: SupportedExchangeCurrency) => void
}

const CURRENCY_NAME_KEY = {
    ARS: 'currencies.ARS',
    EUR: 'currencies.EUR',
    USD: 'currencies.USD',
    GBP: 'currencies.GBP',
    MXN: 'currencies.MXN',
    COP: 'currencies.COP',
    BRL: 'currencies.BRL',
} as const satisfies Record<SupportedExchangeCurrency, string>

export function AllCurrenciesView({
    rates,
    userCountryCode,
    loading = false,
    onSelectCurrency,
}: AllCurrenciesViewProps) {
    const t = useTranslations('exchangeRate')
    const locale = useLocale()
    const ordered = getOrderedCurrencies(userCountryCode)

    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between px-1 text-body-xs text-foreground-secondary">
                <span>{t('allCurrencies.currencyCol')}</span>
                <span>{t('allCurrencies.buySellCol')}</span>
            </div>
            <ListGroup>
                {ordered.map((code) => {
                    const flagUrl = getCurrencyFlagUrl(code)
                    const entry = rates?.[code]
                    const dec = RATE_DECIMALS[code]

                    const trailing =
                        code === 'USD' ? (
                            <span className="text-body-s-semibold text-foreground-primary">{'1:1'}</span>
                        ) : loading && !entry ? (
                            <span className="text-body-s text-foreground-secondary">{'…'}</span>
                        ) : entry ? (
                            <div className="flex flex-col items-end text-right">
                                <span className="text-body-s-semibold text-foreground-primary">
                                    {formatAmountNumber(entry.buyRate, dec, dec, locale)}
                                </span>
                                <span className="text-body-xs text-foreground-secondary">
                                    {formatAmountNumber(entry.sellRate, dec, dec, locale)}
                                </span>
                            </div>
                        ) : (
                            <span className="text-body-s text-foreground-secondary">{'—'}</span>
                        )

                    return (
                        <ListItem
                            key={code}
                            title={`${code} · ${t(CURRENCY_NAME_KEY[code])}`}
                            leading={
                                flagUrl ? (
                                    <Image
                                        src={flagUrl}
                                        alt={code}
                                        width={28}
                                        height={28}
                                        className="size-7 shrink-0 rounded-full object-cover"
                                    />
                                ) : undefined
                            }
                            trailing={trailing}
                            onClick={() => onSelectCurrency(code)}
                            data-testid={`currency-row-${code}`}
                        />
                    )
                })}
            </ListGroup>
        </div>
    )
}
