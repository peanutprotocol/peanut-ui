'use client'
import StatusBadge from '@/components/Global/Badges/StatusBadge'
import { Icon } from '@/components/Global/Icons/Icon'
import { SearchInput } from '@/components/SearchInput'
import { getCountriesForRegion } from '@/utils/identityVerification'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import CountryListSection from './CountryListSection'

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

            <CountryListSection
                title="Available countries in this region"
                description="Choose the one you want to move money on."
                countries={filteredSupportedCountries}
                onCountryClick={(country) => {
                    if (isLatam) {
                        router.push(`/profile/identity-verification/${region}/${encodeURIComponent(country.id)}`)
                    } else {
                        router.push(`/profile/identity-verification/${region}/${encodeURIComponent('bridge')}`)
                    }
                }}
                rightContent={() => (isLatam ? undefined : <Icon name="check" className="size-4 text-success-1" />)}
            />

            <CountryListSection
                title="Coming soon"
                countries={filteredUnsupportedCountries}
                onCountryClick={() => {}}
                rightContent={() => <StatusBadge status="soon" />}
                isDisabled
            />
        </div>
    )
}

export default IdentityVerificationCountryList
