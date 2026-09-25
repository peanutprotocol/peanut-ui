import { countryData, type CountryData } from '@/components/AddMoney/consts'

// a handful of real countries, so a demo list shows its shape without 200 rows
const DEMO_ISO2 = ['AR', 'BR', 'CO', 'DE', 'ES', 'PT']

export const DEMO_COUNTRIES: CountryData[] = countryData.filter(
    (country) => country.type === 'country' && !!country.iso2 && DEMO_ISO2.includes(country.iso2)
)

export const SEPA_DEMO_COUNTRIES: CountryData[] = countryData.filter(
    (country) => country.type === 'country' && !!country.iso2 && ['AT', 'BE', 'DE', 'ES', 'FR'].includes(country.iso2)
)

export const logTap = (what: string) => () => console.log(`[dev/accordion] tap ${what}`)
