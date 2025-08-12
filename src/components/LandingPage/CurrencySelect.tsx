'use client'
import { Popover, PopoverTrigger, PopoverContent } from '@chakra-ui/react'
import React, { useState, useMemo } from 'react'
import BaseInput from '../0_Bruddle/BaseInput'
import { Icon } from '../Global/Icons/Icon'
import { twMerge } from 'tailwind-merge'
import Image from 'next/image'

interface CurrencySelectProps {
    selectedCurrency: string
    setSelectedCurrency: (currency: string) => void
    trigger: React.ReactNode
}

const currencies = [
    {
        countryCode: 'us',
        country: 'United States',
        currency: 'USD',
    },
    {
        countryCode: 'eu',
        country: 'Euro',
        currency: 'EUR',
    },
    {
        countryCode: 'mx',
        country: 'Mexico',
        currency: 'MXN',
    },
]

const CurrencySelect = ({ selectedCurrency, setSelectedCurrency, trigger }: CurrencySelectProps) => {
    const [searchTerm, setSearchTerm] = useState('')

    const filteredCurrencies = useMemo(() => {
        if (!searchTerm.trim()) {
            return currencies
        }

        const lowerSearchTerm = searchTerm.toLowerCase().trim()
        return currencies.filter(
            (currency) =>
                currency.currency.toLowerCase().includes(lowerSearchTerm) ||
                currency.country.toLowerCase().includes(lowerSearchTerm)
        )
    }, [searchTerm])

    return (
        <Popover placement="bottom-end">
            <PopoverTrigger>{trigger}</PopoverTrigger>
            <PopoverContent
                width="sm"
                height={'52'} //{'72'}
                marginTop="16px"
                borderRadius="2px"
                border="1px"
                borderColor="black"
                overflow="scroll"
            >
                <div className="flex w-full flex-col gap-4 p-4">
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

                    <div className="flex w-full flex-col items-start">
                        {/* <h2 className="text-left text-xs font-normal text-gray-1">Popular currencies</h2> */}
                        {filteredCurrencies.map((currency) => (
                            <CurrencyBox
                                key={currency.countryCode}
                                countryCode={currency.countryCode}
                                country={currency.country}
                                currency={currency.currency}
                                selected={currency.currency === selectedCurrency}
                                onSelect={() => {
                                    setSelectedCurrency(currency.currency)
                                }}
                            />
                        ))}
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    )
}

export default CurrencySelect

interface CurrencyBoxProps {
    selected?: boolean
    countryCode: string
    country: string
    currency: string
    onSelect: () => void
}
const CurrencyBox = ({ selected, countryCode, country, currency, onSelect }: CurrencyBoxProps) => {
    return (
        <div
            onClick={onSelect}
            className={twMerge(
                'flex w-full cursor-pointer justify-between px-4 py-2',
                selected && 'rounded-sm border border-gray-1'
            )}
        >
            <div className="flex items-center gap-2">
                <Image
                    src={`https://flagcdn.com/w320/${countryCode}.png`}
                    alt={`${countryCode} flag`}
                    width={160}
                    height={160}
                    className="size-4 rounded-full object-cover"
                />
                <h3 className="text-base font-bold">{currency}</h3>
                <span className="text-xs font-medium text-gray-1">{country}</span>
            </div>

            {selected && <Icon name="success" className="text-gray-1" />}
        </div>
    )
}
