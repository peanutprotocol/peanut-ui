'use client'
import { Icon } from '@/components/Global/Icons/Icon'
import { SearchInput } from '@/components/SearchInput'
import { getCountriesForRegion } from '@/utils/identityVerification'
import { MantecaSupportedExchanges } from '@/components/AddMoney/consts'
import StatusBadge from '@/components/Global/Badges/StatusBadge'
import { Button } from '@/components/0_Bruddle/Button'
import * as Accordion from '@radix-ui/react-accordion'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import CountryListSection from './CountryListSection'
import ActionModal from '@/components/Global/ActionModal'

const IdentityVerificationCountryList = ({ region }: { region: string }) => {
    const [searchTerm, setSearchTerm] = useState('')
    const router = useRouter()
    const [isUnavailableModalOpen, setIsUnavailableModalOpen] = useState(false)
    const [selectedUnavailableCountry, setSelectedUnavailableCountry] = useState<string | null>(null)

    const { supportedCountries, limitedAccessCountries, unsupportedCountries } = getCountriesForRegion(region)

    // Filter both arrays based on search term
    const filteredSupportedCountries = supportedCountries.filter((country) =>
        country.title.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const filteredLimitedAccessCountries = limitedAccessCountries.filter((country) =>
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

            <Accordion.Root
                type="multiple"
                defaultValue={['available-countries', 'limited-access']}
                className="space-y-4"
            >
                <CountryListSection
                    value="available-countries"
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
                    defaultOpen
                />

                <CountryListSection
                    value="limited-access"
                    title="Limited access"
                    description="These countries support verification, but don't have full payment support yet."
                    countries={filteredLimitedAccessCountries}
                    onCountryClick={(country) => {
                        // Check if country is in MantecaSupportedExchanges
                        const countryCode = country.iso2?.toUpperCase()
                        const isMantecaSupported =
                            countryCode && Object.prototype.hasOwnProperty.call(MantecaSupportedExchanges, countryCode)

                        if (isMantecaSupported && isLatam) {
                            // Route to Manteca-specific KYC
                            router.push(`/profile/identity-verification/${region}/${encodeURIComponent(country.id)}`)
                        } else {
                            // Route to Bridge KYC for all other countries
                            router.push(`/profile/identity-verification/${region}/${encodeURIComponent('bridge')}`)
                        }
                    }}
                    rightContent={() => (
                        <div className="flex items-center gap-2">
                            <StatusBadge status="custom" customText="Limited access" />
                            <Button
                                shadowSize="4"
                                size="small"
                                className="h-6 w-6 rounded-full p-0 shadow-[0.12rem_0.12rem_0_#000000]"
                            >
                                <div className="flex size-7 items-center justify-center">
                                    <Icon name="chevron-up" className="h-9 rotate-90" />
                                </div>
                            </Button>
                        </div>
                    )}
                    defaultOpen
                />

                {filteredUnsupportedCountries.length > 0 && (
                    <CountryListSection
                        value="unsupported-countries"
                        title="Not available"
                        description="Verification not supported in these countries yet."
                        countries={filteredUnsupportedCountries}
                        onCountryClick={(country) => {
                            setSelectedUnavailableCountry(country.title)
                            setIsUnavailableModalOpen(true)
                        }}
                        rightContent={() => (
                            <div className="flex items-center gap-2">
                                <StatusBadge
                                    status="custom"
                                    className="border border-error-2 bg-error-1 text-error"
                                    customText="Unavailable"
                                />
                            </div>
                        )}
                        defaultOpen
                    />
                )}
            </Accordion.Root>

            <ActionModal
                icon="alert"
                iconContainerClassName="bg-secondary-1"
                title={`Verification not available in ${selectedUnavailableCountry}`}
                description="We're unable to verify users from this region at this time. If you have legal residence in another country, please select that instead."
                visible={isUnavailableModalOpen}
                onClose={() => {
                    setSelectedUnavailableCountry(null)
                    setIsUnavailableModalOpen(false)
                }}
                ctas={[
                    {
                        text: 'I Understand',
                        shadowSize: '4',
                        onClick: () => {
                            setSelectedUnavailableCountry(null)
                            setIsUnavailableModalOpen(false)
                        },
                    },
                ]}
            />
        </div>
    )
}

export default IdentityVerificationCountryList
