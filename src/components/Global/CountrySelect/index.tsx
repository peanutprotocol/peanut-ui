import React from 'react'
import Select from '@/components/Global/Select'
import countries from 'i18n-iso-countries'

interface CountryDropdownProps {
    value: string | null
    onChange: (value: string) => void
    error?: string
    className?: string
}

// Define priority countries that should appear at the top
const PRIORITY_COUNTRIES = ['USA', 'CAN']

const CountryDropdown: React.FC<CountryDropdownProps> = ({ value, onChange, error, className }) => {
    const countryNames = countries.getNames('en', { select: 'alias' })

    // Create and sort country list with priorities
    const countryList = Object.keys(countryNames)
        .map((code) => ({
            name: countryNames[code],
            code: countries.alpha2ToAlpha3(code) ?? '',
            isPriority: PRIORITY_COUNTRIES.includes(countries.alpha2ToAlpha3(code) ?? ''),
        }))
        .sort((a, b) => {
            // First sort by priority
            if (a.isPriority && !b.isPriority) return -1
            if (!a.isPriority && b.isPriority) return 1
            // Then sort alphabetically
            return a.name.localeCompare(b.name)
        })

    const country = countryList.find((country) => country.code === value)?.name

    return (
        <div className="flex w-full flex-col items-start justify-center gap-2">
            <Select
                items={countryList}
                value={country}
                placeholder="Country"
                onChange={(value: any) => {
                    onChange(value)
                }}
                classButton={`h-12 w-full bg-white px-4 py-2 font-normal dark:bg-n-1 
                    ${error ? 'border-red' : 'border border-n-1 dark:border-white'}`}
                classPlaceholder="text-[#718096] font-normal"
                classOption="font-normal"
                classOptions="max-h-48 overflow-y-auto"
                className={`w-full ${className}`}
            />
            {error && <span className="text-h9 font-normal text-red">{error}</span>}
        </div>
    )
}

export default CountryDropdown
