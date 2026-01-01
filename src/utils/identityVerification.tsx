import {
    ALL_COUNTRIES_ALPHA3_TO_ALPHA2,
    countryData,
    MEXICO_ALPHA3_TO_ALPHA2,
    UNSUPPORTED_ALPHA3_TO_ALPHA2,
} from '@/components/AddMoney/consts'

export const getCountriesForRegion = (region: string) => {
    const supportedCountriesIso3 = Object.keys(ALL_COUNTRIES_ALPHA3_TO_ALPHA2).concat(
        Object.keys(MEXICO_ALPHA3_TO_ALPHA2) // Add Mexico as well, supported by bridge
    )

    const unsupportedCountriesIso3 = Object.keys(UNSUPPORTED_ALPHA3_TO_ALPHA2)

    const countries = countryData.filter((country) => country.region === region)

    const supportedCountries = []
    const limitedAccessCountries = []
    const unsupportedCountries = []

    for (const country of countries) {
        if (country.iso3 && supportedCountriesIso3.includes(country.iso3)) {
            supportedCountries.push({ ...country, isSupported: true })
        } else if (country.iso3 && unsupportedCountriesIso3.includes(country.iso3)) {
            unsupportedCountries.push({ ...country, isSupported: false })
        } else {
            limitedAccessCountries.push({ ...country, isSupported: false })
        }
    }

    return { supportedCountries, limitedAccessCountries, unsupportedCountries }
}
