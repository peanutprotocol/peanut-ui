import { SYMBOLS_BY_CURRENCY_CODE } from '@/constants/currency-symbols.consts'

// Helper function to get currency symbol based on code
export const getDisplayCurrencySymbol = (code?: string, fallbackSymbol: string = '$'): string => {
    if (!code) return fallbackSymbol
    const upperCode = code.toUpperCase()
    return SYMBOLS_BY_CURRENCY_CODE[upperCode] ?? upperCode
}

/**
 * A bank amount as people read it: "€2,000" or "€2,000.50" — no ".00" on a
 * round amount (design.md, copy). Rounds to the cent first, so 1999.999 is "€2,000".
 */
export const formatBankAmount = (amount: string | number, currencyCode: string): string => {
    const symbol = getDisplayCurrencySymbol(currencyCode)
    // A currency with no symbol of its own shows its code, which needs a space: "ARS 1,000", not "ARS1,000".
    const prefix = /^[A-Z]+$/.test(symbol) ? `${symbol} ` : symbol
    return `${prefix}${formatAmountNumber(amount)}`
}

/**
 * The number part of {@link formatBankAmount}: "2,000.50", "2,000", "0.10".
 * For a line that already carries its currency code ("≈ USD 0.10").
 */
export const formatAmountNumber = (amount: string | number): string => {
    const value = typeof amount === 'string' ? parseFloat(amount) : amount
    if (isNaN(value)) return '0'
    return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\.00$/, '')
}

/**
 * `amount` rounded UP to `decimals`, as the server prices a charge: a local
 * amount converted to the USD that pays it (withdraw quote, request amount).
 */
export const roundUpToDecimals = (amount: number, decimals: number): number => {
    const factor = 10 ** decimals
    // Binary floating point puts an exact 8.29 just above 829 minor units, and
    // a bare ceil would then charge a cent nobody owes. Nine decimals is far
    // below any real rate's precision and far above the error.
    return Math.ceil(Number((amount * factor).toFixed(9))) / factor
}
