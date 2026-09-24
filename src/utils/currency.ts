import { SYMBOLS_BY_CURRENCY_CODE } from '@/hooks/useCurrency'

// Helper function to get currency symbol based on code
export const getDisplayCurrencySymbol = (code?: string, fallbackSymbol: string = '$'): string => {
    if (!code) return fallbackSymbol
    const upperCode = code.toUpperCase()
    return SYMBOLS_BY_CURRENCY_CODE[upperCode] ?? upperCode
}

// Simple currency amount formatter
export const formatCurrencyAmount = (amount: string | number, currencyCode: string): string => {
    const symbol = getDisplayCurrencySymbol(currencyCode)
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount

    // A currency with no symbol of its own shows its code, which needs a space: "ARS 1,000", not "ARS1,000".
    const prefix = /^[A-Z]+$/.test(symbol) ? `${symbol} ` : symbol

    if (isNaN(numAmount)) return `${prefix}0`

    const formatted = numAmount.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })

    return `${prefix}${formatted}`
}

/**
 * A bank amount as people read it: "€2,000" or "€2,000.50" — no ".00" on a
 * round amount (design.md, copy). Rounds to the cent first, so 1999.999 is "€2,000".
 */
export const formatBankAmount = (amount: string | number, currencyCode: string): string =>
    formatCurrencyAmount(amount, currencyCode).replace(/\.00$/, '')
