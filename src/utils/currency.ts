// Helper function to get currency symbol based on code
export const getDisplayCurrencySymbol = (code?: string, fallbackSymbol: string = '$'): string => {
    if (!code) return fallbackSymbol

    const upperCode = code.toUpperCase()

    switch (upperCode) {
        case 'ARS':
            return 'AR$'
        case 'USD':
            return '$'
        case 'EUR':
            return '€'
        case 'GBP':
            return '£'
        case 'JPY':
            return '¥'
        default:
            return upperCode // Return the currency code itself as fallback (e.g., "CAD", "CHF")
    }
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
