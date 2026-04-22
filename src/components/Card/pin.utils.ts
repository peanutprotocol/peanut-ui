/**
 * Client-side PIN validation — mirrors the backend rules in `secrets.ts`.
 * Both layers enforce so a bad PIN fails fast client-side with a clear
 * message, and the server still rejects a crafted request.
 */

export interface PinValidationResult {
    valid: boolean
    reason?: string
}

export function validatePin(pin: string): PinValidationResult {
    if (!/^\d{4}$/.test(pin)) return { valid: false, reason: 'PIN must be 4 digits' }
    if (/^(\d)\1{3}$/.test(pin)) return { valid: false, reason: 'No repeating digits (e.g., 1111)' }
    const digits = pin.split('').map(Number)
    const asc = digits.every((d, i) => i === 0 || d === digits[i - 1] + 1)
    const desc = digits.every((d, i) => i === 0 || d === digits[i - 1] - 1)
    if (asc || desc) return { valid: false, reason: 'No sequential digits (e.g., 1234)' }
    return { valid: true }
}
