/**
 * Client-side PIN validation — mirrors the backend rules in `secrets.ts`.
 * Both layers enforce so a bad PIN fails fast client-side with a clear
 * message, and the server still rejects a crafted request.
 */

/** Rejection cause. Callers map it to display copy — this module stays copy-free. */
export type PinRejectionReason = 'length' | 'repeating' | 'sequential'

export interface PinValidationResult {
    valid: boolean
    reason?: PinRejectionReason
}

export function validatePin(pin: string): PinValidationResult {
    if (!/^\d{4}$/.test(pin)) return { valid: false, reason: 'length' }
    if (/^(\d)\1{3}$/.test(pin)) return { valid: false, reason: 'repeating' }
    const digits = pin.split('').map(Number)
    const asc = digits.every((d, i) => i === 0 || d === digits[i - 1] + 1)
    const desc = digits.every((d, i) => i === 0 || d === digits[i - 1] - 1)
    if (asc || desc) return { valid: false, reason: 'sequential' }
    return { valid: true }
}
