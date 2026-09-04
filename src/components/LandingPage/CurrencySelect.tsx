'use client'
import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react'
import React, { useMemo } from 'react'
import { Icon } from '../Global/Icons/Icon'
import { twMerge } from '@/utils/tw'
import Image from 'next/image'
import countryCurrencyMappings, { getFlagUrl } from '@/constants/countryCurrencyMapping'
import StatusBadge from '../Global/Badges/StatusBadge'

interface CurrencySelectProps {
    selectedCurrency: string
    setSelectedCurrency: (currency: string) => void
    trigger: React.ReactNode
    excludeCurrencies?: string[]
}

// The exchange-rate widget only supports the currencies backed by an actual
// payment rail (ACH/wire, SEPA, Faster Payments, SPEI, Manteca) — kept in this
// display order regardless of countryCurrencyMapping.ts's own ordering.
const SUPPORTED_EXCHANGE_CURRENCIES = ['USD', 'EUR', 'GBP', 'MXN', 'ARS', 'BRL']

// Transform the currency mappings into the format expected by the component
const currencies = SUPPORTED_EXCHANGE_CURRENCIES.map((code) => {
    const mapping = countryCurrencyMappings.find((m) => m.currencyCode === code)!
    return {
        countryCode: mapping.flagCode,
        country: mapping.country,
        currency: mapping.currencyCode,
        currencyName: mapping.currencyName,
        comingSoon: mapping.comingSoon || false,
    }
})

const CurrencySelect = ({
    selectedCurrency,
    setSelectedCurrency,
    trigger,
    excludeCurrencies = [],
}: CurrencySelectProps) => {
    const availableCurrencies = useMemo(
        () => currencies.filter((currency) => !excludeCurrencies.includes(currency.currency)),
        [excludeCurrencies]
    )

    return (
        <Popover className="relative">
            {({ close }) => (
                <>
                    <PopoverButton as={React.Fragment}>{trigger}</PopoverButton>
                    <PopoverPanel
                        anchor="bottom end"
                        className="z-50 mt-4 w-72 overflow-scroll rounded-sm border border-black bg-white shadow-lg sm:w-80 md:w-96"
                        // usePullToRefresh listens on `document` and only bails on window.scrollY > 0,
                        // so scrolling this panel at page top reads as a pull. Same guard as Global/Drawer.
                        onTouchMove={(e: React.TouchEvent) => e.stopPropagation()}
                    >
                        <div className="flex max-h-full w-full flex-col items-start overflow-y-scroll p-4">
                            {availableCurrencies.map((currency, index) => (
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
                    src={getFlagUrl(countryCode)}
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
