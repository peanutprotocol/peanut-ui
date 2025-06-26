export interface CurrencyConfig {
    currency: string
    paymentRail: string
}

/**
 * Get currency configuration for a specific country
 * USA -> USD/ACH, Mexico -> MXN/SPEI, everything else -> EUR/SEPA
 */
export const getCurrencyConfig = (countryId: string): CurrencyConfig => {
    if (countryId === 'US') {
        return {
            currency: 'usd',
            paymentRail: 'ach_push',
        }
    }

    if (countryId === 'MX') {
        return {
            currency: 'mxn',
            paymentRail: 'spei',
        }
    }

    // All other countries use EUR/SEPA
    return {
        currency: 'eur',
        paymentRail: 'sepa',
    }
}
