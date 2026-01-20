import { countryData as ALL_METHODS_DATA, type CountryData } from '@/components/AddMoney/consts'
import { type Account, AccountType } from '@/interfaces'

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
    if (countryId === 'US' || countryId === 'USA') {
        return {
            currency: 'usd',
            paymentRail: operationType === 'onramp' ? 'ach_push' : 'ach',
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
        ach: 'ACH Transfer',
        sepa: 'SEPA Transfer',
        spei: 'SPEI Transfer',
        wire: 'Wire Transfer',
    }
    return displayNames[paymentRail] || paymentRail.toUpperCase()
}

export function getCountryFromAccount(account: Account): CountryData | undefined {
    const threeLetterCountryCode = (account.details.countryCode ?? '').toUpperCase()

    let countryInfo
    if (account.type === AccountType.US) {
        countryInfo = ALL_METHODS_DATA.find((c) => c.id === 'US')
    } else {
        countryInfo = account.details.countryName
            ? ALL_METHODS_DATA.find((c) => c.path.toLowerCase() === account.details.countryName?.toLowerCase())
            : ALL_METHODS_DATA.find((c) => c.id === threeLetterCountryCode)
    }
    return countryInfo
}

/**
 * Infer bank account type from account identifier format
 * Used for displaying bank account types in analytics/admin tools
 */
export const inferBankAccountType = (accountId: string): string => {
    if (!accountId) return 'Bank Account'
    
    // Reference IDs (not real account numbers)
    if (accountId.startsWith('manteca_') || accountId.startsWith('bank_')) {
        return 'Bank Account'
    }
    
    // IBAN: starts with 2 letters + 2 digits (e.g., ES12, DE89, FR76)
    if (/^[A-Z]{2}\d{2}[A-Z0-9]+$/i.test(accountId)) {
        return 'SEPA (IBAN)'
    }
    
    // CBU/CVU (Argentina): exactly 22 digits
    // CBU = Clave Bancaria Uniforme (traditional)
    // CVU = Clave Virtual Uniforme (virtual wallets like MercadoPago)
    if (/^\d{22}$/.test(accountId)) {
        return 'CBU/CVU'
    }
    
    // CLABE (Mexico): 18 digits (allow 16-20 for padding variance)
    // CLABEs typically start with 3-digit bank code (e.g., 646, 012, 002)
    if (/^\d{18}$/.test(accountId)) {
        return 'SPEI (CLABE)'
    }
    
    // PIX (Brazil): Can be CPF (11 digits), CNPJ (14 digits), or UUID
    // Check for UUID format first (most distinctive)
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(accountId)) {
        return 'PIX (Random Key)'
    }
    // CPF format: 11 digits
    if (/^\d{11}$/.test(accountId)) {
        return 'PIX (CPF)'
    }
    // CNPJ format: 14 digits
    if (/^\d{14}$/.test(accountId)) {
        return 'PIX (CNPJ)'
    }
    // PIX can also be email or phone - check if it contains @ or + 
    if (accountId.includes('@')) {
        return 'PIX (Email)'
    }
    if (accountId.startsWith('+') || /^\d{10,15}$/.test(accountId)) {
        // Phone numbers: +5511999999999 or just 11999999999
        return 'PIX (Phone)'
    }
    
    // CLABE with padding: 16-20 digits (but not 18 which is standard, not 22 which is CBU)
    if (/^\d{16,17}$/.test(accountId) || /^\d{19,20}$/.test(accountId)) {
        return 'SPEI (CLABE)'
    }
    
    // ACH (US): typically 9-15 digits (routing + account)
    if (/^\d{9,10}$/.test(accountId) || /^\d{12,13}$/.test(accountId) || /^\d{15}$/.test(accountId)) {
        return 'ACH'
    }
    
    // Fallback for other numeric formats
    if (/^\d+$/.test(accountId)) {
        return 'Bank Account'
    }
    
    return 'Bank Account'
}
