'use client'
import {
    type CountryData,
    countryData,
    ALL_COUNTRIES_ALPHA3_TO_ALPHA2,
    BRIDGE_ALPHA3_TO_ALPHA2,
    PREFERRED_COUNTRY_ISO2,
} from '@/components/AddMoney/consts'
import EmptyState from '@/components/Global/EmptyStates/EmptyState'
import { SearchInput } from '@/components/SearchInput'
import Image from 'next/image'
import { useMemo, useState, useDeferredValue, type ReactNode } from 'react'
import { getCardPosition } from '../Global/Card/card.utils'
import { useGeoLocation } from '@/hooks/useGeoLocation'
import { CountryListSkeleton } from './CountryListSkeleton'
import AvatarWithBadge from '../Profile/AvatarWithBadge'
import { getFlagUrl } from '@/constants/countryCurrencyMapping'
import EasterEggModal, { EASTER_EGG_COUNTRIES } from '@/components/Global/EasterEggModal'
import StatusBadge from '../Global/Badges/StatusBadge'
import Loading from '../Global/Loading'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ActionListCard } from '../ActionListCard'
import { isMantecaSupportedCountryCode } from '@/constants/manteca.consts'

// precompute bridge alpha2 values for O(1) lookup
const BRIDGE_ALPHA2_SET = new Set(Object.values(BRIDGE_ALPHA3_TO_ALPHA2))

// MIGRATION-REVIEW: `isBridgeSupportedCountry` was sourced from `useIdentityVerification`, but it
// is a PURE static lookup over BRIDGE_ALPHA3_TO_ALPHA2 — it never read any KYC/Sumsub state (the
// migration map's "selectedLevel" note for CountryList was stale; this file never used it).
// Inlined verbatim so the file no longer depends on the legacy hook. Behavior is identical.
const isBridgeSupportedCountry = (code: string): boolean => {
    const upper = code.toUpperCase()
    return upper === 'US' || upper === 'MX' || upper in BRIDGE_ALPHA3_TO_ALPHA2 || BRIDGE_ALPHA2_SET.has(upper)
}

interface CountryListViewProps {
    inputTitle: string
    inputDescription?: string
    viewMode: 'claim-request' | 'add-withdraw' | 'general-verification'
    onCountryClick: (country: CountryData) => void
    onCryptoClick?: (flow: 'add' | 'withdraw') => void
    flow?: 'add' | 'withdraw'
    getRightContent?: (country: CountryData, isSupported: boolean) => ReactNode
    // when true and viewMode is 'add-withdraw', disable countries that are not supported
    // this is used for the send -> bank flow to prevent selecting unsupported countries
    enforceSupportedCountries?: boolean
    showLoadingState?: boolean
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
}: CountryListViewProps) => {
    const t = useTranslations('global')
    const searchParams = useSearchParams()
    // get currencyCode from search params
    const currencyCode = searchParams.get('currencyCode')

    const [searchTerm, setSearchTerm] = useState(currencyCode ?? '')
    // use deferred value to prevent blocking ui during search
    const deferredSearchTerm = useDeferredValue(searchTerm)
    const { countryCode: userGeoLocationCountryCode, isLoading: isGeoLoading } = useGeoLocation()
    // track which country is being clicked to show loading state
    const [clickedCountryId, setClickedCountryId] = useState<string | null>(null)

    // easter egg modal state
    const [easterEggCountry, setEasterEggCountry] = useState<string | null>(null)

    const supportedCountries = countryData.filter((country) => country.type === 'country')

    // sort countries: user's geo-located country first, then preferred countries
    // (in declared order), then everyone else alphabetically.
    const sortedCountries = useMemo(() => {
        const preferredRank = (country: CountryData) => {
            const iso2 = country.iso2 ?? ALL_COUNTRIES_ALPHA3_TO_ALPHA2[country.id]
            const i = iso2 ? PREFERRED_COUNTRY_ISO2.indexOf(iso2 as (typeof PREFERRED_COUNTRY_ISO2)[number]) : -1
            return i === -1 ? Infinity : i
        }

        return [...supportedCountries].sort((a, b) => {
            if (userGeoLocationCountryCode) {
                const aIsUserCountry =
                    ALL_COUNTRIES_ALPHA3_TO_ALPHA2[a.id] === userGeoLocationCountryCode ||
                    a.id === userGeoLocationCountryCode
                const bIsUserCountry =
                    ALL_COUNTRIES_ALPHA3_TO_ALPHA2[b.id] === userGeoLocationCountryCode ||
                    b.id === userGeoLocationCountryCode

                if (aIsUserCountry && !bIsUserCountry) return -1
                if (!aIsUserCountry && bIsUserCountry) return 1
            }

            const aRank = preferredRank(a)
            const bRank = preferredRank(b)
            if (aRank !== bRank) return aRank - bRank

            return a.title.localeCompare(b.title)
        })
    }, [userGeoLocationCountryCode])

    // filter countries based on deferred search term to prevent blocking ui
    const filteredCountries = useMemo(() => {
        if (!deferredSearchTerm) return sortedCountries

        return sortedCountries.filter(
            (country) =>
                country.title.toLowerCase().includes(deferredSearchTerm.toLowerCase()) ||
                country.currency?.toLowerCase().includes(deferredSearchTerm.toLowerCase())
        )
    }, [deferredSearchTerm, sortedCountries])

    return (
        <div className="flex h-full w-full flex-1 flex-col justify-start gap-4">
            <div className="space-y-2">
                <div className="text-base font-bold">{inputTitle}</div>
                {inputDescription && <p className="text-xs font-normal">{inputDescription}</p>}
                <SearchInput
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onClear={() => setSearchTerm('')}
                    placeholder={t('countryList.searchPlaceholder')}
                />
            </div>
            {isGeoLoading ? (
                <CountryListSkeleton />
            ) : (
                <div className="flex-1 overflow-y-auto">
                    {!searchTerm && viewMode === 'add-withdraw' && onCryptoClick && (
                        <div className="mb-2">
                            <ActionListCard
                                key="crypto"
                                title={
                                    flow === 'withdraw'
                                        ? t('countryList.cryptoWithdrawTitle')
                                        : t('countryList.cryptoDepositTitle')
                                }
                                description={
                                    flow === 'add'
                                        ? t('countryList.cryptoDepositDescription')
                                        : t('countryList.cryptoWithdrawDescription')
                                }
                                onClick={() => onCryptoClick(flow!)}
                                position={'single'}
                                leftIcon={
                                    <AvatarWithBadge icon="wallet-outline" size="extra-small" className="bg-yellow-1" />
                                }
                            />
                        </div>
                    )}
                    {filteredCountries.length > 0 ? (
                        filteredCountries.map((country, index) => {
                            const twoLetterCountryCode =
                                ALL_COUNTRIES_ALPHA3_TO_ALPHA2[country.id.toUpperCase()] ?? country.id.toLowerCase()
                            const position = getCardPosition(index, filteredCountries.length)

                            const isBridgeSupportedCountryResult = isBridgeSupportedCountry(country.id)
                            const isMantecaSupportedCountry = isMantecaSupportedCountryCode(country.id)

                            // determine if country is supported based on view mode
                            let isSupported = false

                            if (viewMode === 'add-withdraw') {
                                // for send->bank flow, enforce only bridge or manteca supported countries
                                if (enforceSupportedCountries) {
                                    isSupported = isBridgeSupportedCountryResult
                                } else {
                                    // otherwise allow all countries
                                    isSupported = true
                                }
                            } else if (viewMode === 'general-verification') {
                                // all countries can verify even if they cant
                                // withdraw
                                isSupported = true
                            } else if (viewMode === 'claim-request') {
                                // support bridge or manteca supported countries, but temporarily disable sepa corridors
                                // where local currency is not eur (show as soon)
                                isSupported = isBridgeSupportedCountryResult || isMantecaSupportedCountry
                            } else {
                                // support all countries
                                isSupported = true
                            }

                            const customRight = getRightContent ? getRightContent(country, isSupported) : undefined

                            return (
                                <ActionListCard
                                    key={country.id}
                                    title={country.title}
                                    rightContent={
                                        customRight ??
                                        (showLoadingState && clickedCountryId === country.id ? (
                                            <Loading />
                                        ) : !isSupported && !EASTER_EGG_COUNTRIES[country.id] ? (
                                            <StatusBadge status="soon" />
                                        ) : undefined)
                                    }
                                    description={country.currency}
                                    onClick={() => {
                                        // check for easter egg countries first
                                        if (EASTER_EGG_COUNTRIES[country.id]) {
                                            setEasterEggCountry(country.id)
                                            return
                                        }
                                        // set loading state immediately for visual feedback
                                        setClickedCountryId(country.id)
                                        onCountryClick(country)
                                    }}
                                    position={position}
                                    isDisabled={
                                        (!isSupported && !EASTER_EGG_COUNTRIES[country.id]) ||
                                        clickedCountryId === country.id
                                    }
                                    leftIcon={
                                        <div className="relative h-8 w-8">
                                            <Image
                                                src={getFlagUrl(twoLetterCountryCode)}
                                                alt={t('countryList.flagAlt', { country: country.title })}
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

            {/* Easter egg modal for weird/uninhabited countries */}
            <EasterEggModal
                visible={!!easterEggCountry}
                onClose={() => setEasterEggCountry(null)}
                countryCode={easterEggCountry ?? ''}
            />
        </div>
    )
}
