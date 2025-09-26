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
import { useMemo, useState, type ReactNode } from 'react'
import { getCardPosition } from '../Global/Card'
import { useGeoLocation } from '@/hooks/useGeoLocation'
import { CountryListSkeleton } from './CountryListSkeleton'
import AvatarWithBadge from '../Profile/AvatarWithBadge'
import StatusBadge from '../Global/Badges/StatusBadge'

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
    const [searchTerm, setSearchTerm] = useState('')
    const { countryCode: userGeoLocationCountryCode, isLoading: isGeoLoading } = useGeoLocation()

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

    // filter countries based on search term
    const filteredCountries = useMemo(() => {
        if (!searchTerm) return sortedCountries

        return sortedCountries.filter(
            (country) =>
                country.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                country.currency?.toLowerCase().includes(searchTerm.toLowerCase())
        )
    }, [searchTerm, sortedCountries])

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
                                // support all bridge and manteca supported countries
                                isSupported = isBridgeSupportedCountry || isMantecaSupportedCountry
                            } else if (viewMode === 'claim-request') {
                                // support all bridge and manteca supported countries
                                isSupported = isBridgeSupportedCountry || isMantecaSupportedCountry
                            } else {
                                // support all countries
                                isSupported = true
                            }

                            // flag used to show soon badge based on the view mode, check country code map keys and values for supported countries
                            // const isSupported =
                            //     viewMode === 'add-withdraw' ||
                            //     viewMode === 'general-verification' ||
                            //     ['US', 'MX', ...Object.keys(countryCodeMap), ...Object.values(countryCodeMap)].includes(
                            //         country.id
                            //     )

                            const customRight = getRightContent ? getRightContent(country, isSupported) : undefined

                            return (
                                <SearchResultCard
                                    key={country.id}
                                    title={country.title}
                                    rightContent={customRight ?? (!isSupported && <StatusBadge status="soon" />)}
                                    description={country.currency}
                                    onClick={() => onCountryClick(country)}
                                    position={position}
                                    isDisabled={!isSupported}
                                    leftIcon={
                                        <div className="relative h-8 w-8">
                                            <Image
                                                src={`https://flagcdn.com/w160/${twoLetterCountryCode.toLowerCase()}.png`}
                                                alt={`${country.title} flag`}
                                                width={80}
                                                height={80}
                                                className="h-8 w-8 rounded-full object-cover"
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
