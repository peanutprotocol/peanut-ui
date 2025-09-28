export interface CountryCurrencyMapping {
    currencyCode: string
    currencyName: string
    country: string
    flagCode: string
    comingSoon?: boolean
}

export const countryCurrencyMappings: CountryCurrencyMapping[] = [
    // SEPA Countries (Eurozone)
    { currencyCode: 'EUR', currencyName: 'Euro', country: 'Eurozone', flagCode: 'eu' },

    // Non-Eurozone SEPA Countries
    { currencyCode: 'BGN', currencyName: 'Bulgarian Lev', country: 'Bulgaria', flagCode: 'bg' },
    { currencyCode: 'CZK', currencyName: 'Czech Koruna', country: 'Czech Republic', flagCode: 'cz' },
    { currencyCode: 'DKK', currencyName: 'Danish Krone', country: 'Denmark', flagCode: 'dk' },
    { currencyCode: 'HUF', currencyName: 'Hungarian Forint', country: 'Hungary', flagCode: 'hu' },
    { currencyCode: 'ISK', currencyName: 'Icelandic Krona', country: 'Iceland', flagCode: 'is' },
    { currencyCode: 'NOK', currencyName: 'Norwegian Krone', country: 'Norway', flagCode: 'no' },
    { currencyCode: 'PLN', currencyName: 'Polish Zloty', country: 'Poland', flagCode: 'pl' },
    { currencyCode: 'RON', currencyName: 'Romanian Leu', country: 'Romania', flagCode: 'ro' },
    { currencyCode: 'SEK', currencyName: 'Swedish Krona', country: 'Sweden', flagCode: 'se' },
    { currencyCode: 'CHF', currencyName: 'Swiss Franc', country: 'Switzerland', flagCode: 'ch' },
    { currencyCode: 'GBP', currencyName: 'British Pound Sterling', country: 'United Kingdom', flagCode: 'gb' },

    // USA
    { currencyCode: 'USD', currencyName: 'US Dollar', country: 'United States', flagCode: 'us' },

    // Mexico
    { currencyCode: 'MXN', currencyName: 'Mexican Peso', country: 'Mexico', flagCode: 'mx' },

    // Coming Soon
    { currencyCode: 'BRL', currencyName: 'Brazilian Real', country: 'Brazil', flagCode: 'br', comingSoon: true },
    { currencyCode: 'ARS', currencyName: 'Argentine Peso', country: 'Argentina', flagCode: 'ar', comingSoon: true },
]

export default countryCurrencyMappings
