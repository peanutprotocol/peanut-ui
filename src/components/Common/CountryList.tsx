'use client'
import {
    type CountryData,
    countryData,
    ALL_COUNTRIES_ALPHA3_TO_ALPHA2,
    PREFERRED_COUNTRY_ISO2,
} from '@/components/AddMoney/consts'
import EmptyState from '@/components/Global/EmptyStates/EmptyState'
import { SearchInput } from '@/components/SearchInput'
import Image from 'next/image'
import { useCallback, useMemo, useState, useDeferredValue, type ReactNode } from 'react'
import { getCardPosition } from '../Global/Card/card.utils'
import { useHomeCountry } from '@/features/destinations/useHomeCountry'
import { CountryListSkeleton } from './CountryListSkeleton'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { getFlagUrl } from '@/constants/countryCurrencyMapping'
import EasterEggDrawer, { EASTER_EGG_COUNTRIES } from '@/components/Global/EasterEggDrawer'
import { CountryWaitlist } from './CountryWaitlist'
import { isSendToBankCountry, liveRailsForCountry } from '@/features/destinations/country-rails'
import Loading from '../Global/Loading'
import { useSearchParams } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { isMantecaSupportedCountryCode } from '@/constants/manteca.consts'
import { localizedCountryTitle } from '@/utils/country-name.utils'
import { matchesCountryQuery } from './country-search'
import { hasBridgeBankCorridor } from '@/components/AddWithdraw/bank-corridors'

interface CountryListViewProps {
    inputTitle?: string
    inputDescription?: string
    viewMode: 'claim-request' | 'add-withdraw' | 'general-verification'
    onCountryClick: (country: CountryData) => void
    onCryptoClick?: (flow: 'add' | 'withdraw') => void
    flow?: 'add' | 'withdraw'
    getRightContent?: (country: CountryData, isSupported: boolean) => ReactNode
    // Send has stricter country support than own-account withdrawal.
    enforceSupportedCountries?: boolean
    showLoadingState?: boolean
    /**
     * Whether a country has anything behind its row, when the caller knows
     * better than the rail table does. Add money asks its own resolver, which
     * also counts a standing corridor and a top-up flow; without it Brazil and
     * Colombia read as unsupported and land on the waitlist.
     */
    isCountrySupported?: (country: CountryData) => boolean
    /**
     * The search term, when the caller owns it. A screen that filters several
     * sections at once has one field above them all, so this list renders no
     * field of its own and filters on what it is given.
     */
    searchTerm?: string
    /**
     * The list continues a card the caller opened above it, so its first row
     * keeps the square top edge that joins the two into one card.
     */
    continuesGroup?: boolean
    /**
     * Show these countries only. The withdraw currency-first selector uses this
     * to disambiguate a shared payout currency — tapping EUR shows the countries
     * that pay out in euros, country as the secondary step. The caller owns the
     * set because "pays out in EUR" is not the country's own currency: Poland
     * (PLN) cashes out in euros over SEPA.
     */
    countries?: CountryData[]
}

/**
 * Displays list of countries with search functionality!
 *
 * @param {object} props
 * @param {string} props.inputTitle The title for the input
 * @param {string} props.inputDescription The description for the input
 * @param {string} props.viewMode The view mode of the list, either 'claim-request' or 'add-withdraw' or 'general-verification'
 * @param {function} props.onCountryClick The function to call when a country is clicked
 * @param {function} props.onCryptoClick The function to call when the crypto button is clicked
 * @param {string} props.flow The flow of the list, either 'add' or 'withdraw', only required for 'add-withdraw' view mode
 * @param {boolean} props.showLoadingState Whether to show loading state when clicking a country, true by default
 * @returns {JSX.Element}
 */
export const CountryList = ({
    inputTitle,
    inputDescription,
    viewMode,
    onCountryClick,
    onCryptoClick,
    flow,
    getRightContent,
    enforceSupportedCountries,
    showLoadingState = true, // true by default to show loading state when clicking a country
    isCountrySupported,
    searchTerm: controlledSearchTerm,
    continuesGroup = false,
    countries,
}: CountryListViewProps) => {
    const t = useTranslations('global')
    const locale = useLocale()
    const searchParams = useSearchParams()
    // get currencyCode from search params
    const currencyCode = searchParams.get('currencyCode')

    const [ownSearchTerm, setOwnSearchTerm] = useState(currencyCode ?? '')
    // the caller's term wins outright where it is given — the list then has no
    // field of its own to keep in step with it
    const searchTerm = controlledSearchTerm ?? ownSearchTerm
    // use deferred value to prevent blocking ui during search
    const deferredSearchTerm = useDeferredValue(searchTerm)
    const { countryCode: homeCountryCode, isLoading: isHomeCountryLoading } = useHomeCountry()
    // track which country is being clicked to show loading state
    const [clickedCountryId, setClickedCountryId] = useState<string | null>(null)

    // easter egg modal state
    const [easterEggCountry, setEasterEggCountry] = useState<string | null>(null)
    const [waitlistCountry, setWaitlistCountry] = useState<CountryData | null>(null)

    const supportedCountries = useMemo(
        () => countries ?? countryData.filter((country) => country.type === 'country'),
        [countries]
    )

    // catalog titles are English; the displayed name comes from Intl.DisplayNames
    const countryName = useCallback((country: CountryData) => localizedCountryTitle(locale, country), [locale])

    // sort countries: the user's own country first, then preferred countries
    // (in declared order), then everyone else alphabetically.
    const sortedCountries = useMemo(() => {
        const preferredRank = (country: CountryData) => {
            const iso2 = country.iso2 ?? ALL_COUNTRIES_ALPHA3_TO_ALPHA2[country.id]
            const i = iso2 ? PREFERRED_COUNTRY_ISO2.indexOf(iso2 as (typeof PREFERRED_COUNTRY_ISO2)[number]) : -1
            return i === -1 ? Infinity : i
        }

        return [...supportedCountries].sort((a, b) => {
            if (homeCountryCode) {
                const aIsUserCountry =
                    ALL_COUNTRIES_ALPHA3_TO_ALPHA2[a.id] === homeCountryCode || a.id === homeCountryCode
                const bIsUserCountry =
                    ALL_COUNTRIES_ALPHA3_TO_ALPHA2[b.id] === homeCountryCode || b.id === homeCountryCode

                if (aIsUserCountry && !bIsUserCountry) return -1
                if (!aIsUserCountry && bIsUserCountry) return 1
            }

            const aRank = preferredRank(a)
            const bRank = preferredRank(b)
            if (aRank !== bRank) return aRank - bRank

            return countryName(a).localeCompare(countryName(b), locale)
        })
    }, [homeCountryCode, countryName, locale, supportedCountries])

    // filter countries based on deferred search term to prevent blocking ui.
    // The English title stays searchable so "Brazil" still finds "Brasil".
    const filteredCountries = useMemo(() => {
        if (!deferredSearchTerm) return sortedCountries

        const term = deferredSearchTerm.trim().toLowerCase()
        return sortedCountries.filter((country) => matchesCountryQuery(country, term, countryName(country)))
    }, [deferredSearchTerm, sortedCountries, countryName])

    return (
        <div className="flex h-full w-full flex-1 flex-col justify-start gap-4">
            {controlledSearchTerm === undefined && (
                <div className="space-y-2">
                    {inputTitle && <div className="text-body-m-semibold">{inputTitle}</div>}
                    {inputDescription && <p className="text-body-xs">{inputDescription}</p>}
                    <SearchInput
                        value={ownSearchTerm}
                        onChange={setOwnSearchTerm}
                        onClear={() => setOwnSearchTerm('')}
                        placeholder={t('countryList.searchPlaceholder')}
                    />
                </div>
            )}
            {isHomeCountryLoading ? (
                <CountryListSkeleton />
            ) : (
                <div className="flex-1 overflow-y-auto">
                    {!searchTerm && viewMode === 'add-withdraw' && onCryptoClick && (
                        <div className="mb-2">
                            <ListItem
                                key="crypto"
                                title={
                                    flow === 'withdraw'
                                        ? t('countryList.cryptoWithdrawTitle')
                                        : t('countryList.cryptoDepositTitle')
                                }
                                body={
                                    <div>
                                        {flow === 'add'
                                            ? t('countryList.cryptoDepositDescription')
                                            : t('countryList.cryptoWithdrawDescription')}
                                    </div>
                                }
                                onClick={() => onCryptoClick(flow!)}
                                position={'solo'}
                                chevron
                                leading={<IconBubble icon="coins" color="blue" size="s" />}
                            />
                        </div>
                    )}
                    {filteredCountries.length > 0 ? (
                        filteredCountries.map((country, index) => {
                            const twoLetterCountryCode =
                                ALL_COUNTRIES_ALPHA3_TO_ALPHA2[country.id.toUpperCase()] ?? country.id.toLowerCase()
                            const position = continuesGroup
                                ? index === filteredCountries.length - 1
                                    ? 'bottom'
                                    : 'middle'
                                : getCardPosition(index, filteredCountries.length)
                            const displayName = countryName(country)

                            // "Does this country have a live Bridge bank corridor" is read from
                            // the one corridor table (bank-corridors.ts) that the offramp route
                            // and the withdraw form read too — so Colombia's `co_bank_transfer`,
                            // and any future corridor, reach every list without a second country
                            // list to keep in step. See the parity test in bank-corridors.test.ts.
                            const hasBankCorridor = hasBridgeBankCorridor(country.id)
                            const isMantecaSupportedCountry = isMantecaSupportedCountryCode(country.id)

                            // determine if country is supported based on view mode
                            let isSupported = false

                            if (isCountrySupported) {
                                isSupported = isCountrySupported(country)
                            } else if (viewMode === 'add-withdraw') {
                                // send->bank has a stricter gate (Argentina stays out) —
                                // see isSendToBankCountry
                                if (enforceSupportedCountries) {
                                    isSupported = isSendToBankCountry(country)
                                } else {
                                    isSupported = liveRailsForCountry(country.id, flow ?? 'withdraw').length > 0
                                }
                            } else if (viewMode === 'general-verification') {
                                // all countries can verify even if they cant
                                // withdraw
                                isSupported = true
                            } else if (viewMode === 'claim-request') {
                                // a Bridge bank corridor or a Manteca country; non-euro SEPA
                                // members have no corridor and stay on the waitlist.
                                isSupported = hasBankCorridor || isMantecaSupportedCountry
                            } else {
                                // support all countries
                                isSupported = true
                            }

                            const customRight = getRightContent ? getRightContent(country, isSupported) : undefined
                            const trailing =
                                customRight ??
                                (showLoadingState && clickedCountryId === country.id ? <Loading /> : undefined)

                            return (
                                <ListItem
                                    key={country.id}
                                    title={displayName}
                                    trailing={trailing}
                                    chevron={!trailing}
                                    // A caller-supplied set is "the countries this currency
                                    // pays out in", and the caller's own row names that
                                    // currency. The country's local code under it ("Poland
                                    // PLN" inside EUR) promised a payout the rail does not make.
                                    body={countries ? undefined : country.currency}
                                    onClick={() => {
                                        // check for easter egg countries first
                                        if (EASTER_EGG_COUNTRIES[country.id]) {
                                            setEasterEggCountry(country.id)
                                            return
                                        }
                                        if (!isSupported) {
                                            setWaitlistCountry(country)
                                            return
                                        }
                                        // set loading state immediately for visual feedback
                                        setClickedCountryId(country.id)
                                        onCountryClick(country)
                                    }}
                                    position={position}
                                    disabled={clickedCountryId === country.id}
                                    leading={
                                        <div className="relative h-8 w-8">
                                            <Image
                                                src={getFlagUrl(twoLetterCountryCode)}
                                                alt={t('countryList.flagAlt', { country: displayName })}
                                                width={80}
                                                height={80}
                                                className="h-8 w-8 rounded-full object-cover"
                                                // priority load first 10 flags for better perceived performance
                                                priority={index < 10}
                                                loading={index < 10 ? 'eager' : 'lazy'}
                                                onError={(e) => {
                                                    e.currentTarget.style.display = 'none'
                                                }}
                                            />
                                        </div>
                                    }
                                />
                            )
                        })
                    ) : (
                        <EmptyState
                            title={t('countryList.noResultsTitle')}
                            description={t('countryList.noResultsDescription')}
                            icon="search"
                        />
                    )}
                </div>
            )}

            {waitlistCountry && (
                <CountryWaitlist
                    countryCode={(
                        waitlistCountry.iso2 ??
                        ALL_COUNTRIES_ALPHA3_TO_ALPHA2[waitlistCountry.id] ??
                        waitlistCountry.id
                    ).toUpperCase()}
                    countryName={countryName(waitlistCountry)}
                    flow={
                        viewMode === 'claim-request'
                            ? 'claim'
                            : enforceSupportedCountries
                              ? 'send'
                              : (flow ?? 'withdraw')
                    }
                    onClose={() => setWaitlistCountry(null)}
                />
            )}

            {/* Easter egg modal for weird/uninhabited countries */}
            <EasterEggDrawer
                visible={!!easterEggCountry}
                onClose={() => setEasterEggCountry(null)}
                countryCode={easterEggCountry ?? ''}
            />
        </div>
    )
}
