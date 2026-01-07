'use client'
import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react'
import React, { useState, useMemo } from 'react'
import BaseInput from '../0_Bruddle/BaseInput'
import { Icon } from '../Global/Icons/Icon'
import { twMerge } from 'tailwind-merge'
import Image from 'next/image'
import countryCurrencyMappings from '@/constants/countryCurrencyMapping'
import StatusBadge from '../Global/Badges/StatusBadge'

interface CurrencySelectProps {
    selectedCurrency: string
    setSelectedCurrency: (currency: string) => void
    trigger: React.ReactNode
    excludeCurrencies?: string[]
}

// Transform the currency mappings into the format expected by the component
const currencies = countryCurrencyMappings.map((mapping) => ({
    countryCode: mapping.flagCode,
    country: mapping.country,
    currency: mapping.currencyCode,
    currencyName: mapping.currencyName,
    comingSoon: mapping.comingSoon || false,
}))

const popularCurrencies = ['USD', 'EUR', 'MXN']

const CurrencySelect = ({
    selectedCurrency,
    setSelectedCurrency,
    trigger,
    excludeCurrencies = [],
}: CurrencySelectProps) => {
    const [searchTerm, setSearchTerm] = useState('')

    const filteredCurrencies = useMemo(() => {
        // First filter out excluded currencies
        const availableCurrencies = currencies.filter((currency) => !excludeCurrencies.includes(currency.currency))

        if (!searchTerm.trim()) {
            return availableCurrencies
        }

        const lowerSearchTerm = searchTerm.toLowerCase().trim()
        return availableCurrencies.filter(
            (currency) =>
                currency.currency.toLowerCase().includes(lowerSearchTerm) ||
                currency.country.toLowerCase().includes(lowerSearchTerm) ||
                currency.currencyName.toLowerCase().includes(lowerSearchTerm)
        )
    }, [searchTerm, excludeCurrencies])

    return (
        <Popover className="relative">
            {({ close }) => (
                <>
                    <PopoverButton as={React.Fragment}>{trigger}</PopoverButton>
                    <PopoverPanel
                        anchor="bottom end"
                        className="mt-4 h-72 w-72 overflow-scroll rounded-sm border border-black bg-white shadow-lg sm:w-80 md:w-96"
                    >
                        <div className="flex max-h-full w-full flex-col gap-4 overflow-hidden p-4">
                            <div className="relative w-full">
                                <div className="absolute left-2 top-1/2 -translate-y-1/2">
                                    <Icon name="search" size={15} />
                                </div>
                                <BaseInput
                                    type="text"
                                    placeholder="Currency or country"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="h-10 w-full rounded-sm border-[1.15px] border-black pl-10 pr-10 font-normal caret-[#FF90E8] focus:border-black focus:outline-none focus:ring-0"
                                />
                            </div>

                            <div className="flex max-h-full w-full flex-col items-start overflow-y-scroll">
                                {!searchTerm && (
                                    <h2 className="text-left text-xs font-normal text-gray-1">Popular currencies</h2>
                                )}
                                {filteredCurrencies
                                    .filter((currency) => popularCurrencies.includes(currency.currency))
                                    .map((currency, index) => (
                                        <CurrencyBox
                                            key={`${currency.countryCode}-${currency.country}-${index}`}
                                            countryCode={currency.countryCode}
                                            country={currency.country}
                                            currency={currency.currency}
                                            currencyName={currency.currencyName}
                                            comingSoon={currency.comingSoon}
                                            selected={currency.currency === selectedCurrency}
                                            onSelect={() => {
                                                if (!currency.comingSoon) {
                                                    close()
                                                    setSelectedCurrency(currency.currency)
                                                }
                                            }}
                                        />
                                    ))}

                                {!searchTerm && (
                                    <h2 className="text-left text-xs font-normal text-gray-1">All currencies</h2>
                                )}
                                {filteredCurrencies
                                    .filter((currency) => !popularCurrencies.includes(currency.currency))
                                    .map((currency, index) => (
                                        <CurrencyBox
                                            key={`${currency.countryCode}-${currency.country}-${index}`}
                                            countryCode={currency.countryCode}
                                            country={currency.country}
                                            currency={currency.currency}
                                            currencyName={currency.currencyName}
                                            comingSoon={currency.comingSoon}
                                            selected={currency.currency === selectedCurrency}
                                            onSelect={() => {
                                                if (!currency.comingSoon) {
                                                    close()
                                                    setSelectedCurrency(currency.currency)
                                                }
                                            }}
                                        />
                                    ))}
                            </div>
                        </div>
                    </PopoverPanel>
                </>
            )}
        </Popover>
    )
}

export default CurrencySelect

interface CurrencyBoxProps {
    selected?: boolean
    countryCode: string
    country: string
    currency: string
    currencyName: string
    comingSoon?: boolean
    onSelect: () => void
}
const CurrencyBox = ({
    selected,
    countryCode,
    country,
    currency,
    currencyName,
    comingSoon = false,
    onSelect,
}: CurrencyBoxProps) => {
    return (
        <div
            onClick={onSelect}
            className={twMerge(
                'flex w-full justify-between px-4 py-2',
                !comingSoon && 'cursor-pointer',
                comingSoon && 'cursor-not-allowed bg-grey-4 opacity-75',
                selected && !comingSoon && 'rounded-sm border border-gray-1'
            )}
        >
            <div className="flex items-center gap-2">
                <Image
                    src={`https://flagcdn.com/w320/${countryCode}.png`}
                    alt={`${countryCode} flag`}
                    width={160}
                    height={160}
                    className="size-4 rounded-full object-cover"
                    onError={(e) => {
                        e.currentTarget.style.display = 'none'
                    }}
                />
                <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                        <h3 className={twMerge('text-base font-bold', comingSoon && 'text-gray-1')}>{currency}</h3>
                        <span className="text-xs font-medium text-gray-1">{currencyName}</span>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-2">
                {comingSoon && <StatusBadge status="soon" size="small" />}
                {selected && !comingSoon && <Icon size={14} name="success" className="font-light text-gray-1" />}
            </div>
        </div>
    )
}
