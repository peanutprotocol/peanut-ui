// Helper function to get currency symbol based on code
export const getDisplayCurrencySymbol = (code?: string, fallbackSymbol: string = '$'): string => {
    if (code === 'ARS') return 'AR$'
    if (code === 'USD') return '$'
    return fallbackSymbol
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
