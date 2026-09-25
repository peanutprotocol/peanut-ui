'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import { localizedCurrencyName } from '@/utils/currency-name.utils'
import { type CountryData } from '@/components/AddMoney/consts'
import { CountryList } from '@/components/Common/CountryList'
import { SearchInput } from '@/components/SearchInput'
import { Accordion } from '@/components/0_Bruddle/Accordion'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { CONCEPT_ICONS } from '@/components/0_Bruddle/conceptIcons'
import Loading from '@/components/Global/Loading'
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
    /**
     * The country path a tap is currently navigating to, or null when nothing
     * is in flight. That row loads in place, so the wait is shown on the row
     * the user pressed. The caller ignores any further tap while it is set.
     */
    pendingPath?: string | null
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
    onCountryClick,
    onCryptoClick,
    enforceSupportedCountries,
    initialQuery = '',
    pendingPath = null,
}: WithdrawCurrencyListProps) {
    const t = useTranslations('withdraw')
    const tGlobal = useTranslations('global')
    const tRails = useTranslations('depositAccounts.rows.rails')
    const locale = useLocale()
    const [query, setQuery] = useState(initialQuery)

    const currencies = useMemo(
        () => liveWithdrawCurrencies({ sendToBankOnly: !!enforceSupportedCountries }),
        [enforceSupportedCountries]
    )
    const filteredCurrencies = useMemo(
        () => currencies.filter((currency) => currencyMatchesQuery(currency, query, locale)),
        [currencies, query, locale]
    )

    /**
     * The destination a tap on this row opens, or null when the row only
     * expands in place. Both the tap and the row's pending state read it, so
     * the spinner cannot end up on a different row from the navigation.
     */
    const routedDestination = (currency: WithdrawCurrency): CountryData | null => {
        // One country behind the currency: nothing to disambiguate — route it.
        if (currency.countries.length === 1) return currency.countries[0]
        // The IBAN answers the country question, so it is never asked: the euro
        // area is one destination and the form reads the country off the IBAN.
        if (currencyRoutesByIban(currency)) return SEPA_DESTINATION
        return null
    }

    return (
        <div className="flex min-h-inherit flex-col gap-4">
            {/* no heading: the nav title already says Withdraw or Send */}
            <SearchInput
                value={query}
                onChange={setQuery}
                onClear={() => setQuery('')}
                placeholder={t('currencyList.searchPlaceholder')}
                aria-label={t('currencyList.searchPlaceholder')}
            />

            {/* crypto sits beside the currencies, never inside them */}
            {!query && onCryptoClick && (
                <ListItem
                    key="crypto"
                    title={tGlobal('countryList.cryptoWithdrawTitle')}
                    body={tGlobal('countryList.cryptoWithdrawDescription')}
                    bodyWrap
                    chevron
                    leading={<IconBubble {...CONCEPT_ICONS.crypto} size="s" />}
                    onClick={onCryptoClick}
                    data-testid="withdraw-crypto"
                />
            )}

            {filteredCurrencies.length > 0 && (
                // Which shared-currency row is open is transient UI: it survives
                // no refresh and belongs in no shared link, so the accordion owns it
                <Accordion type="single" collapsible className="gap-0" data-testid="withdraw-currencies">
                    {filteredCurrencies.map((currency, index) => {
                        const position = getCardPosition(index, filteredCurrencies.length)
                        const title = `${currency.code} · ${tRails(currency.railNameKey)}`
                        const body = localizedCurrencyName(locale, currency.code, currency.name)
                        const testId = `withdraw-currency-${currency.code}`
                        const flag = (
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
                        )
                        const destination = routedDestination(currency)

                        // A shared currency the IBAN does not decide opens its
                        // countries as the secondary step
                        if (!destination) {
                            return (
                                <Accordion.Item key={currency.code} value={currency.code} position={position}>
                                    <Accordion.Trigger leading={flag} title={title} body={body} data-testid={testId} />
                                    <Accordion.Content flush forceMount>
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
                                    </Accordion.Content>
                                </Accordion.Item>
                            )
                        }

                        // the row the user tapped carries the wait, and takes no
                        // second tap while it does
                        const isNavigating = !!pendingPath && destination.path === pendingPath
                        return (
                            <ListItem
                                key={currency.code}
                                title={title}
                                body={body}
                                chevron={!isNavigating}
                                trailing={isNavigating ? <Loading /> : undefined}
                                position={position}
                                disabled={isNavigating}
                                onClick={() => onCountryClick(destination)}
                                data-testid={testId}
                                leading={flag}
                            />
                        )
                    })}
                </Accordion>
            )}

            {/* every other country, one tap away — the country-first list,
                demoted. The row and the list are two cards (kush, 2026-09-25) */}
            <Accordion type="single" collapsible variant="detached" data-testid="withdraw-other-countries">
                <Accordion.Item value="other-countries">
                    <Accordion.Trigger
                        leading={<IconBubble {...CONCEPT_ICONS.otherCountries} size="s" />}
                        title={t('currencyList.otherCountriesTitle')}
                        body={t('currencyList.otherCountriesPitch')}
                        data-testid="withdraw-other-countries-toggle"
                    />
                    <Accordion.Content flush>
                        <CountryList
                            viewMode="add-withdraw"
                            flow="withdraw"
                            searchTerm={query}
                            onCountryClick={onCountryClick}
                            enforceSupportedCountries={enforceSupportedCountries}
                        />
                    </Accordion.Content>
                </Accordion.Item>
            </Accordion>
        </div>
    )
}
