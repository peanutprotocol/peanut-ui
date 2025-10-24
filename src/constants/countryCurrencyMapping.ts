export interface CountryCurrencyMapping {
    currencyCode: string
    currencyName: string
    country: string
    flagCode: string
    comingSoon?: boolean
    path?: string
}

export const countryCurrencyMappings: CountryCurrencyMapping[] = [
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
