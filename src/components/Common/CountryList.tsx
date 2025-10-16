'use client'
import {
    BRIDGE_ALPHA3_TO_ALPHA2,
    CountryData,
    countryData,
    MantecaSupportedExchanges,
    ALL_COUNTRIES_ALPHA3_TO_ALPHA2,
} from '@/components/AddMoney/consts'
import EmptyState from '@/components/Global/EmptyStates/EmptyState'
import { SearchInput } from '@/components/SearchUsers/SearchInput'
import { SearchResultCard } from '@/components/SearchUsers/SearchResultCard'
import Image from 'next/image'
import { useMemo, useState, useDeferredValue, type ReactNode } from 'react'
import { getCardPosition } from '../Global/Card'
import { useGeoLocation } from '@/hooks/useGeoLocation'
import { CountryListSkeleton } from './CountryListSkeleton'
import AvatarWithBadge from '../Profile/AvatarWithBadge'
import StatusBadge from '../Global/Badges/StatusBadge'
import Loading from '../Global/Loading'
import { useSearchParams } from 'next/navigation'

interface CountryListViewProps {
    inputTitle: string
    viewMode: 'claim-request' | 'add-withdraw' | 'general-verification'
    onCountryClick: (country: CountryData) => void
    onCryptoClick?: (flow: 'add' | 'withdraw') => void
    flow?: 'add' | 'withdraw'
    getRightContent?: (country: CountryData, isSupported: boolean) => ReactNode
}

/**
 * Displays list of countries with search functionality!
 *
 * @param {object} props
 * @param {string} props.inputTitle The title for the input
 * @param {string} props.viewMode The view mode of the list, either 'claim-request' or 'add-withdraw' or 'general-verification'
 * @param {function} props.onCountryClick The function to call when a country is clicked
 * @param {function} props.onCryptoClick The function to call when the crypto button is clicked
 * @param {string} props.flow The flow of the list, either 'add' or 'withdraw', only required for 'add-withdraw' view mode
 * @returns {JSX.Element}
 */
export const CountryList = ({
    inputTitle,
    viewMode,
    onCountryClick,
    onCryptoClick,
    flow,
    getRightContent,
}: CountryListViewProps) => {
    const searchParams = useSearchParams()
    // get currencyCode from search params
    const currencyCode = searchParams.get('currencyCode')

    const [searchTerm, setSearchTerm] = useState(currencyCode ?? '')
    // use deferred value to prevent blocking ui during search
    const deferredSearchTerm = useDeferredValue(searchTerm)
    const { countryCode: userGeoLocationCountryCode, isLoading: isGeoLoading } = useGeoLocation()
    // track which country is being clicked to show loading state
    const [clickedCountryId, setClickedCountryId] = useState<string | null>(null)

    const supportedCountries = countryData.filter((country) => country.type === 'country')

    // sort countries based on user's geo location, fallback to alphabetical order
    const sortedCountries = useMemo(() => {
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
                <SearchInput
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onClear={() => setSearchTerm('')}
                    placeholder="Search country"
                />
            </div>
            {isGeoLoading ? (
                <CountryListSkeleton />
            ) : (
                <div className="flex-1 overflow-y-auto">
                    {!searchTerm && viewMode === 'add-withdraw' && onCryptoClick && (
                        <div className="mb-2">
                            <SearchResultCard
                                key="crypto"
                                title={flow === 'withdraw' ? 'Crypto' : 'Crypto Deposit'}
                                description={
                                    flow === 'add'
                                        ? 'Use an exchange or your wallet'
                                        : 'Withdraw to a wallet or exchange'
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

                            const isBridgeSupportedCountry = [
                                'US',
                                'MX',
                                ...Object.keys(BRIDGE_ALPHA3_TO_ALPHA2),
                                ...Object.values(BRIDGE_ALPHA3_TO_ALPHA2),
                            ].includes(country.id)
                            const isMantecaSupportedCountry = Object.keys(MantecaSupportedExchanges).includes(
                                country.id
                            )

                            // determine if country is supported based on view mode
                            let isSupported = false

                            if (viewMode === 'add-withdraw') {
                                // all countries supported for claim-request
                                isSupported = true
                            } else if (viewMode === 'general-verification') {
                                // all countries can verify even if they cant
                                // withdraw
                                isSupported = true
                            } else if (viewMode === 'claim-request') {
                                // support all bridge and manteca supported countries
                                isSupported = isBridgeSupportedCountry || isMantecaSupportedCountry
                            } else {
                                // support all countries
                                isSupported = true
                            }

                            const customRight = getRightContent ? getRightContent(country, isSupported) : undefined

                            return (
                                <SearchResultCard
                                    key={country.id}
                                    title={country.title}
                                    rightContent={
                                        customRight ??
                                        (clickedCountryId === country.id ? (
                                            <Loading />
                                        ) : !isSupported ? (
                                            <StatusBadge status="soon" />
                                        ) : undefined)
                                    }
                                    description={country.currency}
                                    onClick={() => {
                                        // set loading state immediately for visual feedback
                                        setClickedCountryId(country.id)
                                        onCountryClick(country)
                                    }}
                                    position={position}
                                    isDisabled={!isSupported || clickedCountryId === country.id}
                                    leftIcon={
                                        <div className="relative h-8 w-8">
                                            <Image
                                                src={`https://flagcdn.com/w160/${twoLetterCountryCode.toLowerCase()}.png`}
                                                alt={`${country.title} flag`}
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
                            title="No results found"
                            description="Try searching with a different term."
                            icon="search"
                        />
                    )}
                </div>
            )}
        </div>
    )
}
