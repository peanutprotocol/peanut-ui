import { countryData } from '@/components/AddMoney/consts'

// Comprehensive currency symbol mapping
export const CURRENCY_SYMBOLS: Record<string, string> = {
    // Major currencies
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    CHF: 'CHF',
    CAD: 'C$',
    AUD: 'A$',
    NZD: 'NZ$',

    // European currencies
    SEK: 'kr',
    NOK: 'kr',
    DKK: 'kr',
    PLN: 'zł',
    CZK: 'Kč',
    HUF: 'Ft',
    RON: 'lei',
    BGN: 'лв',
    HRK: 'kn',

    // Asian currencies
    CNY: '¥',
    KRW: '₩',
    INR: '₹',
    SGD: 'S$',
    HKD: 'HK$',
    TWD: 'NT$',
    THB: '฿',
    MYR: 'RM',
    IDR: 'Rp',
    PHP: '₱',
    VND: '₫',

    // Latin American currencies
    BRL: 'R$',
    MXN: '$',
    ARS: '$',
    CLP: '$',
    COP: '$',
    PEN: 'S/',
    UYU: '$U',
    PYG: '₲',
    BOB: 'Bs',
    VES: 'Bs',

    // African currencies
    ZAR: 'R',
    NGN: '₦',
    EGP: 'E£',
    KES: 'KSh',
    GHS: '₵',
    MAD: 'د.م.',
    TND: 'د.ت',

    // Middle Eastern currencies
    TRY: '₺',
    ILS: '₪',
    AED: 'د.إ',
    SAR: 'ر.س',
    QAR: 'ر.ق',
    KWD: 'د.ك',
    BHD: 'د.ب',
    OMR: 'ر.ع',
    JOD: 'د.أ',
    LBP: 'ل.ل',

    // Eastern European currencies
    RUB: '₽',
    UAH: '₴',
    BYN: 'Br',
    MKD: 'ден',
    RSD: 'дин',
    ALL: 'L',
    BAM: 'KM',

    // Other currencies
    ISK: 'kr',
    MDL: 'L',
    GEL: '₾',
    AMD: '֏',
    AZN: '₼',
    KZT: '₸',
    UZS: 'сўм',
    KGS: 'сом',
    TJS: 'ЅМ',
    TMT: 'T',
    AFN: '؋',
    PKR: '₨',
    BDT: '৳',
    LKR: '₨',
    NPR: '₨',
    BTN: 'Nu.',
    MVR: 'Rf',
    XCD: 'EC$',
    XAF: 'CFA',
    XOF: 'CFA',
    XPF: 'CFP',
}

/**
 * Get currency symbol for a given currency code
 * @param currencyCode - 3-letter ISO currency code (e.g., 'USD', 'EUR')
 * @returns Currency symbol or the currency code if symbol not found
 */
export function getCurrencySymbol(currencyCode: string): string {
    if (!currencyCode) return '$' // Default to USD symbol

    const upperCode = currencyCode.toUpperCase()
    return CURRENCY_SYMBOLS[upperCode] || upperCode
}

/**
 * Get currency code for a given country using existing countryData
 * @param countryId - Country ID (e.g., 'US', 'DE', 'GB')
 * @returns Currency code or 'USD' as default
 */
export function getCurrencyForCountry(countryId: string): string {
    const country = countryData.find((c) => c.type === 'country' && c.id === countryId)
    return country?.currency || 'USD'
}

/**
 * Get currency code for a given country path using existing countryData
 * @param countryPath - Country path (e.g., 'usa', 'germany', 'united-kingdom')
 * @returns Currency code or 'USD' as default
 */
export function getCurrencyForCountryPath(countryPath: string): string {
    const country = countryData.find((c) => c.type === 'country' && c.path === countryPath)
    return country?.currency || 'USD'
}

/**
 * Format amount with currency symbol
 * @param amount - The amount to format
 * @param currencyCode - 3-letter ISO currency code
 * @param options - Formatting options
 * @returns Formatted string with currency symbol
 */
export function formatCurrencyAmount(
    amount: string | number,
    currencyCode: string,
    options: {
        showDecimals?: boolean
        locale?: string
    } = {}
): string {
    const { showDecimals = true, locale = 'en-US' } = options
    const symbol = getCurrencySymbol(currencyCode)
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount

    if (isNaN(numAmount)) return `${symbol}0`

    // For currencies that typically don't show decimals (like JPY, KRW)
    const noDecimalCurrencies = ['JPY', 'KRW', 'VND', 'IDR', 'CLP', 'PYG', 'KMF', 'GNF', 'RWF', 'UGX']
    const shouldShowDecimals = showDecimals && !noDecimalCurrencies.includes(currencyCode.toUpperCase())

    const formatted = numAmount.toLocaleString(locale, {
        minimumFractionDigits: shouldShowDecimals ? 2 : 0,
        maximumFractionDigits: shouldShowDecimals ? 2 : 0,
    })

    // Handle symbol placement (most currencies use prefix, some use suffix)
    const suffixCurrencies = ['TRY', 'PLN', 'CZK', 'HUF', 'RON', 'BGN']
    if (suffixCurrencies.includes(currencyCode.toUpperCase())) {
        return `${formatted} ${symbol}`
    }

    return `${symbol}${formatted}`
}

/**
 * Check if a currency code is valid
 * @param currencyCode - Currency code to validate
 * @returns True if the currency code is recognized
 */
export function isValidCurrencyCode(currencyCode: string): boolean {
    if (!currencyCode || typeof currencyCode !== 'string') return false
    return CURRENCY_SYMBOLS.hasOwnProperty(currencyCode.toUpperCase())
}
