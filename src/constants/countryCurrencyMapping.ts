export interface CountryCurrencyMapping {
    currencyCode: string
    currencyName: string
    country: string
    flagCode: string
    comingSoon?: boolean
    path?: string
}

const countryCurrencyMappings: CountryCurrencyMapping[] = [
    // SEPA Countries (Eurozone)
    { currencyCode: 'EUR', currencyName: 'Euro', country: 'Eurozone', flagCode: 'eu' },

    // Non-Eurozone SEPA Countries
    { currencyCode: 'BGN', currencyName: 'Bulgarian Lev', country: 'Bulgaria', flagCode: 'bg', path: 'bulgaria' },
    {
        currencyCode: 'CZK',
        currencyName: 'Czech Koruna',
        country: 'Czech Republic',
        flagCode: 'cz',
        path: 'czech-republic',
    },
    { currencyCode: 'DKK', currencyName: 'Danish Krone', country: 'Denmark', flagCode: 'dk', path: 'denmark' },
    { currencyCode: 'HUF', currencyName: 'Hungarian Forint', country: 'Hungary', flagCode: 'hu', path: 'hungary' },
    { currencyCode: 'ISK', currencyName: 'Icelandic Krona', country: 'Iceland', flagCode: 'is', path: 'iceland' },
    { currencyCode: 'NOK', currencyName: 'Norwegian Krone', country: 'Norway', flagCode: 'no', path: 'norway' },
    { currencyCode: 'PLN', currencyName: 'Polish Zloty', country: 'Poland', flagCode: 'pl', path: 'poland' },
    { currencyCode: 'RON', currencyName: 'Romanian Leu', country: 'Romania', flagCode: 'ro', path: 'romania' },
    { currencyCode: 'SEK', currencyName: 'Swedish Krona', country: 'Sweden', flagCode: 'se', path: 'sweden' },
    { currencyCode: 'CHF', currencyName: 'Swiss Franc', country: 'Switzerland', flagCode: 'ch', path: 'switzerland' },
    {
        currencyCode: 'GBP',
        currencyName: 'British Pound Sterling',
        country: 'United Kingdom',
        flagCode: 'gb',
        path: 'united-kingdom',
    },

    // USA
    { currencyCode: 'USD', currencyName: 'US Dollar', country: 'United States', flagCode: 'us', path: 'usa' },

    // Mexico
    { currencyCode: 'MXN', currencyName: 'Mexican Peso', country: 'Mexico', flagCode: 'mx', path: 'mexico' },

    // LATAM Countries
    { currencyCode: 'BRL', currencyName: 'Brazilian Real', country: 'Brazil', flagCode: 'br', path: 'brazil' },
    { currencyCode: 'ARS', currencyName: 'Argentine Peso', country: 'Argentina', flagCode: 'ar', path: 'argentina' },
]

export default countryCurrencyMappings

// country/currency utility functions

/**
 * generates flag url from iso2 country code
 * uses flagcdn.com pattern used throughout the app
 */
export function getFlagUrl(iso2: string, size: 160 | 320 = 160): string {
    return `https://flagcdn.com/w${size}/${iso2.toLowerCase()}.png`
}

/**
 * maps currency code to its flag code (iso2)
 * useful for getting flag from currency like ARS -> ar
 */
export function getCurrencyFlagCode(currencyCode: string): string | null {
    const mapping = countryCurrencyMappings.find((m) => m.currencyCode.toUpperCase() === currencyCode.toUpperCase())
    return mapping?.flagCode ?? null
}

/**
 * gets flag url directly from currency code
 * combines getCurrencyFlagCode + getFlagUrl
 */
export function getCurrencyFlagUrl(currencyCode: string, size: 160 | 320 = 160): string | null {
    const flagCode = getCurrencyFlagCode(currencyCode)
    return flagCode ? getFlagUrl(flagCode, size) : null
}

/**
 * gets country info from currency code
 */
export function getCountryByCurrency(currencyCode: string): CountryCurrencyMapping | null {
    return countryCurrencyMappings.find((m) => m.currencyCode.toUpperCase() === currencyCode.toUpperCase()) ?? null
}

/**
 * checks if currency is from a non-EUR SEPA country
 * these countries are in SEPA zone but use their own currency, not EUR
 * returns true for GBP, PLN, SEK, etc. but false for EUR, USD, MXN, BRL, ARS
 */
export function isNonEuroSepaCountry(currencyCode: string | undefined): boolean {
    if (!currencyCode) return false
    const upper = currencyCode.toUpperCase()

    // explicit list of non-EUR SEPA currencies
    // SEPA includes EU countries that use their own currency
    const nonEurSepaCurrencies = ['GBP', 'PLN', 'SEK', 'DKK', 'CZK', 'HUF', 'RON', 'BGN', 'ISK', 'NOK', 'CHF']

    return nonEurSepaCurrencies.includes(upper)
}

/**
 * checks if country path or code is UK
 * handles various UK identifiers: 'united-kingdom', 'gb', 'gbr'
 */
export function isUKCountry(countryIdentifier: string | undefined): boolean {
    if (!countryIdentifier) return false
    const lower = countryIdentifier.toLowerCase()
    return lower === 'united-kingdom' || lower === 'gb' || lower === 'gbr'
}
