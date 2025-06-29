export interface CurrencyConfig {
    currency: string
    paymentRail: string
}

export type BridgeOperationType = 'onramp' | 'offramp'

/**
 * Get currency configuration for a specific country and operation type
 * USA -> USD/ACH, Mexico -> MXN/SPEI, everything else -> EUR/SEPA
 * Payment rails differ between onramp and offramp operations
 */
export const getCurrencyConfig = (countryId: string, operationType: BridgeOperationType): CurrencyConfig => {
    if (countryId === 'US') {
        return {
            currency: 'usd',
            paymentRail: operationType === 'onramp' ? 'ach_push' : 'ach_pull',
        }
    }

    if (countryId === 'MX') {
        return {
            currency: 'mxn',
            paymentRail: 'spei', // SPEI works for both onramp and offramp in Mexico
        }
    }

    // All other countries use EUR/SEPA
    return {
        currency: 'eur',
        paymentRail: 'sepa', // SEPA works for both onramp and offramp in Europe
    }
}

/**
 * Legacy function for backwards compatibility with existing onramp code
 * @deprecated Use getCurrencyConfig with operationType parameter instead
 */
export const getOnrampCurrencyConfig = (countryId: string): CurrencyConfig => {
    return getCurrencyConfig(countryId, 'onramp')
}

/**
 * Get currency configuration specifically for offramp operations
 */
export const getOfframpCurrencyConfig = (countryId: string): CurrencyConfig => {
    return getCurrencyConfig(countryId, 'offramp')
}

/**
 * Get the fiat currency symbol for display purposes
 */
export const getCurrencySymbol = (currency: string): string => {
    const symbols: Record<string, string> = {
        usd: '$',
        eur: '€',
        mxn: 'MX$',
    }
    return symbols[currency.toLowerCase()] || currency.toUpperCase()
}

/**
 * Get minimum amount for onramp operations by country
 */
export const getMinimumAmount = (countryId: string): number => {
    if (countryId === 'MX') {
        return 50
    }

    // Default minimum for all other countries (including US and EU)
    return 1
}

/**
 * Get human-readable payment rail name
 */
export const getPaymentRailDisplayName = (paymentRail: string): string => {
    const displayNames: Record<string, string> = {
        ach_push: 'ACH Transfer',
        ach_pull: 'ACH Transfer',
        sepa: 'SEPA Transfer',
        spei: 'SPEI Transfer',
        wire: 'Wire Transfer',
    }
    return displayNames[paymentRail] || paymentRail.toUpperCase()
}
