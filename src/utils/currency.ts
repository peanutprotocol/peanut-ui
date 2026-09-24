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

    if (isNaN(numAmount)) return `${symbol}0`

    const formatted = numAmount.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })

    return `${symbol}${formatted}`
}

/** A bank amount as the recipient reads it: "€2,000" or "€2,000.50" — no ".00" on a round amount. */
export const formatBankAmount = (amount: string | number, currencyCode: string): string => {
    const value = Number(amount)
    const formatted = value.toLocaleString('en-US', {
        minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
        maximumFractionDigits: 2,
    })
    return `${getDisplayCurrencySymbol(currencyCode)}${formatted}`
}
