'use client'

import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import { useState } from 'react'
import { Accordion } from '@/components/0_Bruddle/Accordion'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { CountryList } from '@/components/Common/CountryList'
import { getCardPosition } from '@/components/Global/Card/card.utils'
import { Icon } from '@/components/Global/Icons/Icon'
import { getFlagUrl } from '@/constants/countryCurrencyMapping'
import { liveWithdrawCurrencies, type WithdrawCurrency } from '@/features/withdraw/components/withdraw-currencies'
import { localizedCurrencyName } from '@/utils/currency-name.utils'
import { twMerge } from '@/utils/tw'
import { SEPA_DEMO_COUNTRIES, logTap } from './demoCountries'

// no live currency takes the expand path today: EUR routes by IBAN and every
// other currency has one country. EUR is forced into it here, as the only
// currency that would.
const MULTI = 'EUR'

/**
 * The withdraw currency list's multi-country row (WithdrawCurrencyList).
 * Before: a ListItem with a hand-rolled chevron-down, useState and
 * aria-expanded, a CountryList joined below. After: an Accordion.Item placed
 * in the same positional group, its countries in flush content.
 */
export function WithdrawMultiCountryDemo({ mode }: { mode: 'before' | 'after' }) {
    const t = useTranslations('withdraw')
    const tRails = useTranslations('depositAccounts.rows.rails')
    const locale = useLocale()
    const [expandedCurrency, setExpandedCurrency] = useState<string | null>(null)
    const currencies = liveWithdrawCurrencies().filter((currency) => ['GBP', 'EUR', 'USD'].includes(currency.code))

    const flag = (currency: WithdrawCurrency, index: number) => (
        <div className="relative h-8 w-8">
            <Image
                src={getFlagUrl(currency.flagCode)}
                alt={t('currencyList.flagAlt', { currency: currency.code })}
                width={80}
                height={80}
                className="h-8 w-8 rounded-full object-cover"
                priority={index < 10}
            />
        </div>
    )
    const title = (currency: WithdrawCurrency) => `${currency.code} · ${tRails(currency.railNameKey)}`
    const body = (currency: WithdrawCurrency) => localizedCurrencyName(locale, currency.code, currency.name)
    const countries = (
        <CountryList
            viewMode="add-withdraw"
            flow="withdraw"
            countries={SEPA_DEMO_COUNTRIES}
            searchTerm=""
            onCountryClick={(country) => logTap(country.title)()}
            continuesGroup
        />
    )

    if (mode === 'before') {
        return (
            <div>
                {currencies.map((currency, index) => {
                    const isMulti = currency.code === MULTI
                    const expanded = expandedCurrency === currency.code
                    return (
                        <div key={currency.code}>
                            <ListItem
                                title={title(currency)}
                                body={body(currency)}
                                chevron={!isMulti}
                                trailing={
                                    isMulti ? (
                                        <Icon
                                            name="chevron-down"
                                            size={20}
                                            className={twMerge(
                                                'transition-transform duration-moderate',
                                                expanded && 'rotate-180'
                                            )}
                                        />
                                    ) : undefined
                                }
                                position={getCardPosition(index, currencies.length)}
                                aria-expanded={isMulti ? expanded : undefined}
                                onClick={
                                    isMulti
                                        ? () => setExpandedCurrency(expanded ? null : currency.code)
                                        : logTap(currency.code)
                                }
                                leading={flag(currency, index)}
                            />
                            {isMulti && expanded && countries}
                        </div>
                    )
                })}
            </div>
        )
    }

    return (
        <Accordion type="single" collapsible className="gap-0">
            {currencies.map((currency, index) =>
                currency.code === MULTI ? (
                    <Accordion.Item
                        key={currency.code}
                        value={currency.code}
                        position={getCardPosition(index, currencies.length)}
                    >
                        <Accordion.Trigger
                            leading={flag(currency, index)}
                            title={title(currency)}
                            body={body(currency)}
                        />
                        <Accordion.Content flush forceMount>
                            {countries}
                        </Accordion.Content>
                    </Accordion.Item>
                ) : (
                    <ListItem
                        key={currency.code}
                        title={title(currency)}
                        body={body(currency)}
                        chevron
                        position={getCardPosition(index, currencies.length)}
                        onClick={logTap(currency.code)}
                        leading={flag(currency, index)}
                    />
                )
            )}
        </Accordion>
    )
}
