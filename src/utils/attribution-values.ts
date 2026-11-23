// A leaf module of value cleaners for signup attribution.
const MAX_VALUE_LENGTH = 128
const MARKETING_VALUE_PATTERN = /^[A-Za-z0-9][-A-Za-z0-9 ._~+]*$/
const UUID_VALUE_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const WALLET_VALUE_PATTERN = /^0x[0-9a-f]{40}$/i
const IPV4_VALUE_PATTERN = /^(?:\d{1,3}\.){3}\d{1,3}$/

export function cleanValue(value: string | null | undefined, maxLength = MAX_VALUE_LENGTH): string | undefined {
    if (!value) return undefined
    const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, '').trim()
    return cleaned.length > 0 && cleaned.length <= maxLength ? cleaned : undefined
}

export function cleanMarketingValue(value: string | null | undefined): string | undefined {
    const cleaned = cleanValue(value)
    if (
        !cleaned ||
        !MARKETING_VALUE_PATTERN.test(cleaned) ||
        cleaned.includes('@') ||
        cleaned.includes('://') ||
        cleaned.toLowerCase().startsWith('www.') ||
        UUID_VALUE_PATTERN.test(cleaned) ||
        WALLET_VALUE_PATTERN.test(cleaned)
    )
        return undefined
    return cleaned
}

export function cleanHost(value: string | null | undefined): string | undefined {
    const cleaned = cleanValue(value, 255)?.toLowerCase()
    if (!cleaned || !/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?(?::\d{1,5})?$/.test(cleaned)) return undefined
    const hostname = cleaned.replace(/:\d{1,5}$/, '')
    if (UUID_VALUE_PATTERN.test(hostname) || WALLET_VALUE_PATTERN.test(hostname) || IPV4_VALUE_PATTERN.test(hostname)) {
        return undefined
    }
    return cleaned
}
