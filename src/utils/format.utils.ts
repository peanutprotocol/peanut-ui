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
