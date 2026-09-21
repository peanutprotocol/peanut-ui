'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import { localizedCurrencyName } from '@/utils/currency-name.utils'
import { twMerge } from '@/utils/tw'
import { type CountryData } from '@/components/AddMoney/consts'
import { CountryList } from '@/components/Common/CountryList'
import { SearchInput } from '@/components/SearchInput'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { Icon } from '@/components/Global/Icons/Icon'
import { getFlagUrl } from '@/constants/countryCurrencyMapping'
import { getCardPosition } from '@/components/Global/Card/card.utils'
import { SEPA_DESTINATION } from '@/components/AddWithdraw/bank-corridors'
import {
    countriesForQuery,
    currencyMatchesQuery,
    currencyRoutesByIban,
    liveWithdrawCurrencies,
    type WithdrawCurrency,
} from './withdraw-currencies'

interface WithdrawCurrencyListProps {
    /** Heading above the search field ("How would you like to cash out?"). */
    heading: string
    /** A country was resolved — route it (reuses the method view's handler). */
    onCountryClick: (country: CountryData) => void
    /**
     * The crypto (on-chain) row was tapped. Omit it to drop the row: a user who
     * already picked the bank rail upstream must not be offered crypto again.
     */
    onCryptoClick?: () => void
    /** Send has stricter country support than own-account withdrawal. */
    enforceSupportedCountries?: boolean
    /** Search the list opens with — `/withdraw?currencyCode=EUR` lands on the EUR row. */
    initialQuery?: string
}

/**
 * Currency-first cash-out selector. Mirrors the add-money hub: the currencies a
 * user can cash out in come first (EUR, GBP, USD, MXN, local ARS/BRL…), a
 * crypto row sits beside them, and the full country list is demoted to an
 * "Other countries" fallback below.
 *
 * A currency with one supported country routes straight through. A shared
 * currency (EUR across SEPA) expands its countries inline — country is the
 * secondary disambiguation step, not the entry point. All routing stays in the
 * caller's `onCountryClick`, so this component adds no second source of truth
 * for where a country leads.
 */
// TODO(va): extract shared currency-first selector shell (with DepositAccountsListScreen)
export function WithdrawCurrencyList({
    heading,
    onCountryClick,
    onCryptoClick,
    enforceSupportedCountries,
    initialQuery = '',
}: WithdrawCurrencyListProps) {
    const t = useTranslations('withdraw')
    const tGlobal = useTranslations('global')
    const locale = useLocale()
    const [query, setQuery] = useState(initialQuery)
    // Which shared-currency row is expanded to its country list. Transient UI —
    // it survives no refresh and belongs in no shared link, so it stays out of
    // the URL (same rule as the add-money hub's accordion).
    const [expandedCurrency, setExpandedCurrency] = useState<string | null>(null)
    const [otherCountriesOpen, setOtherCountriesOpen] = useState(false)

    const currencies = useMemo(
        () => liveWithdrawCurrencies({ sendToBankOnly: !!enforceSupportedCountries }),
        [enforceSupportedCountries]
    )
    const filteredCurrencies = useMemo(
        () => currencies.filter((currency) => currencyMatchesQuery(currency, query, locale)),
        [currencies, query, locale]
    )

    const handleCurrencyClick = (currency: WithdrawCurrency) => {
        // One country behind the currency: nothing to disambiguate — route it.
        if (currency.countries.length === 1) {
            onCountryClick(currency.countries[0])
            return
        }
        // The IBAN answers the country question, so it is never asked: the euro
        // area is one destination and the form reads the country off the IBAN.
        if (currencyRoutesByIban(currency)) {
            onCountryClick(SEPA_DESTINATION)
            return
        }
        // Any other shared currency: reveal its countries as the secondary step.
        setExpandedCurrency((current) => (current === currency.code ? null : currency.code))
    }

    return (
        <div className="flex min-h-inherit flex-col gap-4">
            <div className="space-y-2">
                <div className="text-body-m-semibold">{heading}</div>
                <SearchInput
                    value={query}
                    onChange={setQuery}
                    onClear={() => setQuery('')}
                    placeholder={t('currencyList.searchPlaceholder')}
                    aria-label={t('currencyList.searchPlaceholder')}
                />
            </div>

            {/* crypto sits beside the currencies, never inside them */}
            {!query && onCryptoClick && (
                <ListItem
                    key="crypto"
                    title={tGlobal('countryList.cryptoWithdrawTitle')}
                    body={tGlobal('countryList.cryptoWithdrawDescription')}
                    bodyWrap
                    chevron
                    leading={<IconBubble icon="coins" color="blue" size="s" />}
                    onClick={onCryptoClick}
                    data-testid="withdraw-crypto"
                />
            )}

            {filteredCurrencies.length > 0 && (
                <div data-testid="withdraw-currencies">
                    {filteredCurrencies.map((currency, index) => {
                        const expanded = expandedCurrency === currency.code
                        // a currency the IBAN decides routes straight through, so
                        // it gets the plain chevron, not the expand affordance
                        const isMulti = currency.countries.length > 1 && !currencyRoutesByIban(currency)
                        return (
                            <div key={currency.code}>
                                <ListItem
                                    title={currency.code}
                                    body={localizedCurrencyName(locale, currency.code, currency.name)}
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
                                    position={getCardPosition(index, filteredCurrencies.length)}
                                    aria-expanded={isMulti ? expanded : undefined}
                                    onClick={() => handleCurrencyClick(currency)}
                                    data-testid={`withdraw-currency-${currency.code}`}
                                    leading={
                                        <div className="relative h-8 w-8">
                                            <Image
                                                src={getFlagUrl(currency.flagCode)}
                                                alt={t('currencyList.flagAlt', { currency: currency.code })}
                                                width={80}
                                                height={80}
                                                className="h-8 w-8 rounded-full object-cover"
                                                priority={index < 10}
                                                loading={index < 10 ? 'eager' : 'lazy'}
                                                onError={(e) => {
                                                    e.currentTarget.style.display = 'none'
                                                }}
                                            />
                                        </div>
                                    }
                                />
                                {isMulti && expanded && (
                                    <CountryList
                                        viewMode="add-withdraw"
                                        flow="withdraw"
                                        countries={countriesForQuery(currency, query, locale)}
                                        // the field above owns the search
                                        searchTerm=""
                                        onCountryClick={onCountryClick}
                                        enforceSupportedCountries={enforceSupportedCountries}
                                        continuesGroup
                                    />
                                )}
                            </div>
                        )
                    })}
                </div>
            )}

            {/* every other country, one tap away — the country-first list, demoted */}
            <div data-testid="withdraw-other-countries">
                <ListItem
                    title={t('currencyList.otherCountriesTitle')}
                    body={t('currencyList.otherCountriesPitch')}
                    bodyWrap
                    leading={<IconBubble icon="globe" color="blue" size="s" />}
                    trailing={
                        <Icon
                            name="chevron-down"
                            size={20}
                            className={twMerge(
                                'transition-transform duration-moderate',
                                otherCountriesOpen && 'rotate-180'
                            )}
                        />
                    }
                    position={otherCountriesOpen ? 'first' : 'single'}
                    aria-expanded={otherCountriesOpen}
                    onClick={() => setOtherCountriesOpen((open) => !open)}
                    data-testid="withdraw-other-countries-toggle"
                />
                {otherCountriesOpen && (
                    <CountryList
                        viewMode="add-withdraw"
                        flow="withdraw"
                        searchTerm={query}
                        onCountryClick={onCountryClick}
                        enforceSupportedCountries={enforceSupportedCountries}
                        continuesGroup
                    />
                )}
            </div>
        </div>
    )
}
