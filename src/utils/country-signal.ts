/** Country hints are advisory; they never establish legal residence. */
export function normalizeCountrySignal(value: unknown): string | null {
    if (typeof value !== 'string') return null
    const code = value.trim().toUpperCase()
    return /^[A-Z]{2}$/.test(code) && code !== 'XX' && code !== 'ZZ' ? code : null
}
