/**
 * Format points for display with thousands separators (e.g. 564,554).
 */
export function formatPoints(points: number): string {
    return points.toLocaleString('en-US')
}

/**
 * Shorten large point values to compact form.
 * Returns { number, suffix } so the suffix (K/M) can be styled separately.
 */
export function shortenPoints(points: number): { number: string; suffix: string } {
    if (points >= 1_000_000) {
        const m = points / 1_000_000
        return { number: m >= 10 ? Math.round(m).toString() : m.toFixed(1).replace(/\.0$/, ''), suffix: 'M' }
    }
    if (points >= 1_000) {
        const k = points / 1_000
        return { number: k >= 10 ? Math.round(k).toString() : k.toFixed(1).replace(/\.0$/, ''), suffix: 'K' }
    }
    return { number: points.toString(), suffix: '' }
}

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

export const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
