export const sanitizeBankAccount = (value: string | undefined): string => {
    if (!value) return ''
    return value.replace(/[\s\-\._]/g, '').toLowerCase()
}

export const formatBankAccountDisplay = (value: string | undefined, type?: 'iban' | 'us'): string => {
    if (!value) return ''
    const sanitized = sanitizeBankAccount(value)

    // If no type specified, try to detect IBAN vs US account
    if (!type) {
        type = /^[A-Z]{2}/i.test(sanitized) ? 'iban' : 'us'
    }

    if (type === 'iban') {
        return sanitized
            .toUpperCase()
            .replace(/(.{4})/g, '$1 ')
            .trim()
    }

    // US account: Split routing and account number if present
    if (sanitized.length > 9) {
        const routing = sanitized.slice(0, 9)
        const account = sanitized.slice(9)
        return `${routing}-${account}`.toUpperCase()
    }

    return sanitized.toUpperCase()
}

export const truncateString = (str: string, maxLength: number = 14): string => {
    if (str.length <= 14) return str
    if (str.length <= maxLength) return str

    return str.slice(0, maxLength - 3) + '...'
}

export const formatCurrencyWithIntl = (
    value: number | string | undefined,
    locale: string = 'en-US', // Default locale
    currencyCode: string = 'USD', // Default currency
    style: 'currency' | 'decimal' = 'currency',
    minimumFractionDigits?: number,
    maximumFractionDigits?: number
): string => {
    if (value === undefined || value === null || value === '') return ''
    const numericValue = typeof value === 'string' ? parseFloat(value) : value
    if (isNaN(numericValue)) return '' // Return empty if not a valid number

    // Determine fraction digits: JPY and some others have 0, most have 2.
    // Default to 2 for currencies unless specified, or 0 for JPY specifically.
    let minDigits = minimumFractionDigits
    let maxDigits = maximumFractionDigits

    if (style === 'currency') {
        if (minDigits === undefined) {
            minDigits = currencyCode === 'JPY' ? 0 : 2
        }
        if (maxDigits === undefined) {
            maxDigits = currencyCode === 'JPY' ? 0 : 2
        }
    } else {
        // decimal style
        if (minDigits === undefined) minDigits = 0
        if (maxDigits === undefined) maxDigits = 20 // Allow high precision for decimal style by default
    }

    // Ensure minDigits is not greater than maxDigits
    minDigits = Math.min(minDigits, maxDigits)

    try {
        return new Intl.NumberFormat(locale, {
            style: style,
            currency: style === 'currency' ? currencyCode : undefined,
            minimumFractionDigits: minDigits,
            maximumFractionDigits: maxDigits,
        }).format(numericValue)
    } catch (error) {
        console.error('Error formatting currency with Intl:', error)
        // Fallback for invalid locale/currency or other errors
        if (style === 'currency') {
            return `${currencyCode} ${numericValue.toFixed(minDigits)}`
        }
        return numericValue.toFixed(minDigits)
    }
}
