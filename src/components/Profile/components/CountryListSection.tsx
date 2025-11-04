import { ActionListCard } from '@/components/ActionListCard'
import { type CountryData } from '@/components/AddMoney/consts'
import { getCardPosition } from '@/components/Global/Card'
import Image from 'next/image'
import { type ReactNode } from 'react'

interface CountryListSectionProps {
    title: string
    description?: string
    countries: (CountryData & { isSupported?: boolean })[]
    onCountryClick: (country: CountryData & { isSupported?: boolean }, index: number) => void
    rightContent?: (country: CountryData & { isSupported?: boolean }, index: number) => ReactNode
    isDisabled?: boolean
}

const CountryListSection = ({
    title,
    description,
    countries,
    onCountryClick,
    rightContent,
    isDisabled = false,
}: CountryListSectionProps) => {
    return (
        <div>
            <h1 className="mb-2 font-bold">{title}</h1>
            {description && <p className="mb-2 text-xs font-normal">{description}</p>}

            {countries.map((country, index) => {
                const position = getCardPosition(index, countries.length)
                return (
                    <ActionListCard
                        key={country.id}
                        title={country.title}
                        description={country.currency}
                        rightContent={rightContent?.(country, index)}
                        onClick={() => onCountryClick(country, index)}
                        position={position}
                        isDisabled={isDisabled}
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
    )
}

export default CountryListSection
