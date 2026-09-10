import type { RecoverFundsPreviewResponse } from '@/services/rain'

// A decimal-integer string is the only thing BigInt() accepts without throwing.
export const isIntegerString = (value: unknown): value is string => typeof value === 'string' && /^-?\d+$/.test(value)

export function isRecoverablePreview(data: RecoverFundsPreviewResponse | undefined | null): boolean {
    return (
        !!data &&
        isIntegerString(data.amountCents) &&
        isIntegerString(data.dustWei) &&
        typeof data.recipient === 'string'
    )
}

// Render Rain cents (2 dp) as a fixed-precision USD amount with thousand
// separators. Cents are bigint-string from the wire — never Number() them
// directly; > 2^53 risks lossy display on whales.
export function formatCents(centsStr: string): string {
    const cents = BigInt(centsStr)
    const dollars = cents / 100n
    const remainder = (cents % 100n).toString().padStart(2, '0')
    return `${dollars.toLocaleString('en-US')}.${remainder}`
}

export function shorten(addr: string): string {
    if (addr.length <= 12) return addr
    return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}
