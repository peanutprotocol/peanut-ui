import React, { useEffect } from 'react'
import Select from '@/components/Global/Select'
import countries from 'i18n-iso-countries'
import enLocale from 'i18n-iso-countries/langs/en.json'

interface CountryDropdownProps {
    value: string | null
    onChange: (value: string) => void
    error?: string
}

const CountryDropdown: React.FC<CountryDropdownProps> = ({ value, onChange, error }) => {
    const countryNames = countries.getNames('en', { select: 'alias' })
    const countryList = Object.keys(countryNames).map((code) => ({
        name: countryNames[code],
        code: countries.alpha2ToAlpha3(code) ?? '', // Convert alpha-2 to alpha-3
    }))

    const country = countryList.find((country) => country.code === value)?.name

    return (
        <div className="flex w-full flex-col items-start justify-center gap-2 ">
            <Select
                items={countryList}
                value={country}
                placeholder="Country"
                onChange={(value: any) => {
                    console.log('value', value)
                    onChange(value)
                }}
                classButton={`px-4 py-2 w-full max-h-12 font-normal ${error ? 'border-red' : 'border-n-1'}`}
                classPlaceholder="text-[#718096] font-normal"
                classOption="font-normal"
                classOptions="max-h-48 overflow-y-auto"
                className={`w-full `}
            />
            {error && <span className="text-h9 font-normal text-red">{error}</span>}
        </div>
    )
}

export default CountryDropdown
