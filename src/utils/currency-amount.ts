import { parseUnits } from 'viem'

export function currencyAmount(value: string, locale: string, centsOnly = false): string | null {
    const normalized = /^(es|pt)(-|$)/.test(locale) ? value.replace(',', '.') : value
    if (!/^(?:0|[1-9]\d{0,11})(?:\.\d{1,6})?$/.test(normalized)) return null
    const units = parseUnits(normalized, 6)
    if (units <= 0n || (centsOnly && units % 10_000n !== 0n)) return null
    return normalized
}
