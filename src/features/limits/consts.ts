import { getFlagUrl } from '@/constants/countryCurrencyMapping'
import { MANTECA_ALPHA3_TO_ALPHA2, countryData } from '@/components/AddMoney/consts'

export const LIMITS_PROVIDERS = ['bridge', 'manteca'] as const
export type LimitsProvider = (typeof LIMITS_PROVIDERS)[number]

// qr-only countries - derived from manteca supported countries
// these are countries where bridge users can make qr payments

// manteca countries are qr-payment enabled countries (argentina, brazil)
const MANTECA_COUNTRY_ISO2 = Object.values(MANTECA_ALPHA3_TO_ALPHA2) // ['AR', 'BR']

// derive qr country data from centralized countryData
const derivedQrCountries = countryData
    .filter((c) => c.type === 'country' && c.iso2 && MANTECA_COUNTRY_ISO2.includes(c.iso2))
    .map((c) => ({
        id: c.path, // 'argentina', 'brazil'
        name: c.title, // 'Argentina', 'Brazil'
        flagCode: c.iso2!.toLowerCase(), // 'ar', 'br'
    }))

export type QrCountryId = 'argentina' | 'brazil'

/**
 * get qr-only country with resolved flag url
 * avoids hardcoding flag urls - uses centralized getFlagUrl
 */
export function getQrCountryWithFlag(id: QrCountryId) {
    const country = derivedQrCountries.find((c) => c.id === id)
    if (!country) return null
    return {
        ...country,
        flag: getFlagUrl(country.flagCode),
    }
}

/**
 * get all qr-only countries with resolved flag urls
 */
export function getQrCountriesWithFlags() {
    return derivedQrCountries.map((country) => ({
        ...country,
        flag: getFlagUrl(country.flagCode),
    }))
}
