'use client'
import { ActionListCard } from '@/components/ActionListCard'
import StatusBadge from '@/components/Global/Badges/StatusBadge'
import { getCardPosition } from '@/components/Global/Card'
import { Icon } from '@/components/Global/Icons/Icon'
import { SearchInput } from '@/components/SearchInput'
import { getCountriesForRegion } from '@/utils/identityVerification'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

const IdentityVerificationCountryList = ({ region }: { region: string }) => {
    const [searchTerm, setSearchTerm] = useState('')
    const router = useRouter()

    const { supportedCountries, unsupportedCountries } = getCountriesForRegion(region)

    // Filter both arrays based on search term
    const filteredSupportedCountries = supportedCountries.filter((country) =>
        country.title.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const filteredUnsupportedCountries = unsupportedCountries.filter((country) =>
        country.title.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const isLatam = region === 'latam'

    return (
        <div className="flex h-full w-full flex-1 flex-col justify-start gap-4">
            <div className="space-y-2">
                <SearchInput
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onClear={() => setSearchTerm('')}
                    placeholder="Search by country name"
                />
            </div>

            <div>
                <h1 className="font-bold">Available countries in this region</h1>
                <p className="mb-2 text-xs font-normal">Choose the one you want to move money on.</p>

                {filteredSupportedCountries.map((country, index) => {
                    const position = getCardPosition(index, filteredSupportedCountries.length)
                    return (
                        <ActionListCard
                            key={country.id}
                            title={country.title}
                            description={country.currency}
                            rightContent={isLatam ? undefined : <Icon name="check" className="size-4 text-success-1" />}
                            onClick={() => {
                                if (isLatam) {
                                    router.push(
                                        `/profile/identity-verification/${region}/${encodeURIComponent(country.id)}`
                                    )
                                } else {
                                    router.push(
                                        `/profile/identity-verification/${region}/${encodeURIComponent('bridge')}`
                                    )
                                }
                            }}
                            position={position}
                            leftIcon={
                                <div className="relative h-8 w-8">
                                    <Image
                                        src={`https://flagcdn.com/w160/${country.iso2?.toLowerCase()}.png`}
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
                })}
            </div>

            <div>
                <h1 className="mb-2 font-bold">Coming soon</h1>

                {filteredUnsupportedCountries.map((country, index) => {
                    const position = getCardPosition(index, filteredUnsupportedCountries.length)
                    return (
                        <ActionListCard
                            key={country.id}
                            title={country.title}
                            description={country.currency}
                            onClick={() => {}}
                            rightContent={<StatusBadge status="soon" />}
                            position={position}
                            isDisabled
                            leftIcon={
                                <div className="relative h-8 w-8">
                                    <Image
                                        src={`https://flagcdn.com/w160/${country.iso2?.toLowerCase()}.png`}
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
                })}
            </div>
        </div>
    )
}

export default IdentityVerificationCountryList
