'use client'
import { countryCodeMap, countryData } from '@/components/AddMoney/consts'
import EmptyState from '@/components/Global/EmptyStates/EmptyState'
import NavHeader from '@/components/Global/NavHeader'
import PeanutActionDetailsCard from '@/components/Global/PeanutActionDetailsCard'
import { SearchInput } from '@/components/SearchUsers/SearchInput'
import { SearchResultCard } from '@/components/SearchUsers/SearchResultCard'
import { useGuestFlow } from '@/context/GuestFlowContext'
import Image from 'next/image'
import { useMemo, useState } from 'react'
import { IClaimScreenProps } from '../../Claim.consts'
import { formatUnits } from 'viem'
import { formatTokenAmount, printableAddress } from '@/utils/general.utils'

export const ClaimCountryListView = ({ claimLinkData }: Pick<IClaimScreenProps, 'claimLinkData'>) => {
    const { setGuestFlowStep, setSelectedCountry, resetGuestFlow } = useGuestFlow()
    const [searchTerm, setSearchTerm] = useState('')

    const supportedCountries = useMemo(() => {
        const sepaCountries = Object.keys(countryCodeMap)
        const supported = new Set([...sepaCountries, 'US', 'MX'])

        return countryData.filter((country) => supported.has(country.id))
    }, [])

    const filteredCountries = useMemo(() => {
        if (!searchTerm) return supportedCountries

        return supportedCountries.filter(
            (country) =>
                country.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                country.currency?.toLowerCase().includes(searchTerm.toLowerCase())
        )
    }, [searchTerm, supportedCountries])

    const handleCountrySelect = (country: (typeof countryData)[0]) => {
        setSelectedCountry(country)
        setGuestFlowStep('bank-form')
    }

    return (
        <div className="flex min-h-[inherit] flex-col justify-normal gap-8">
            <NavHeader title="Receive" onPrev={() => resetGuestFlow()} />
            <div className="flex h-full w-full flex-1 flex-col justify-start gap-4">
                <PeanutActionDetailsCard
                    avatarSize="small"
                    transactionType="CLAIM_LINK"
                    recipientType="USERNAME"
                    recipientName={claimLinkData.sender?.username ?? printableAddress(claimLinkData.senderAddress)}
                    amount={formatTokenAmount(Number(formatUnits(claimLinkData.amount, claimLinkData.tokenDecimals)))!}
                    tokenSymbol={claimLinkData.tokenSymbol}
                />

                <div className="space-y-2">
                    <div className="text-base font-bold">Which country do you want to receive to?</div>
                    <SearchInput
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onClear={() => setSearchTerm('')}
                        placeholder="Search country or currency"
                    />
                </div>
                {searchTerm && filteredCountries.length === 0 ? (
                    <EmptyState
                        title="No results found"
                        description="Try searching with a different term."
                        icon="search"
                    />
                ) : (
                    <div className="flex-1 space-y-2 overflow-y-auto">
                        {filteredCountries.map((country, index) => {
                            const twoLetterCountryCode =
                                countryCodeMap[country.id.toUpperCase()] ?? country.id.toLowerCase()
                            return (
                                <SearchResultCard
                                    key={country.id}
                                    title={country.title}
                                    description={country.currency}
                                    onClick={() => handleCountrySelect(country)}
                                    position={'single'}
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
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
