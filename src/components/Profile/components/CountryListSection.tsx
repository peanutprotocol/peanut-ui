import { ActionListCard } from '@/components/ActionListCard'
import { type CountryData } from '@/components/AddMoney/consts'
import { getCardPosition } from '@/components/Global/Card/card.utils'
import EmptyState from '@/components/Global/EmptyStates/EmptyState'
import { Icon } from '@/components/Global/Icons/Icon'
import * as Accordion from '@radix-ui/react-accordion'
import Image from 'next/image'
import { type ReactNode } from 'react'

interface CountryListSectionProps {
    title: string
    description?: string
    countries: (CountryData & { isSupported?: boolean })[]
    onCountryClick: (country: CountryData & { isSupported?: boolean }, index: number) => void
    rightContent?: (country: CountryData & { isSupported?: boolean }, index: number) => ReactNode
    isDisabled?: boolean
    value: string
    defaultOpen?: boolean
}

const CountryListSection = ({
    title,
    description,
    countries,
    onCountryClick,
    rightContent,
    isDisabled = false,
    value,
    defaultOpen = false,
}: CountryListSectionProps) => {
    return (
        <Accordion.Item value={value}>
            <Accordion.Header>
                <Accordion.Trigger className="group flex w-full items-center justify-between">
                    <h1 className="font-bold">{title}</h1>
                    <Icon
                        name="chevron-down"
                        className="size-4 transition-transform duration-300 group-data-[state=open]:rotate-180"
                    />
                </Accordion.Trigger>
            </Accordion.Header>
            {description && <p className="text-xs font-normal">{description}</p>}
            <Accordion.Content className="mt-2 overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                {countries.length === 0 && (
                    <EmptyState
                        icon="globe-lock"
                        title="No available countries in this region"
                        description="There are currently no supported countries in the selected region. Try selecting a different region or check back later as we expand our coverage."
                    />
                )}

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
            </Accordion.Content>
        </Accordion.Item>
    )
}

export default CountryListSection
