import { createStaticPix, hasError } from 'pix-utils'
import { validatePixKey, isPixEmvcoQr } from './withdraw.utils'

/**
 * Converts a raw PIX key into an EMVCo BR Code string.
 * If the input is already a BR Code, returns it as-is.
 * Returns null if the PIX key is invalid.
 *
 * @param pixKey - The PIX key (email, CPF, CNPJ, phone, UUID) or BR Code
 * @returns The EMVCo BR Code string, or null if invalid
 */
export const pixKeyToBRCode = (pixKey: string): string | null => {
    const trimmed = pixKey.trim()

    // Already a BR Code? Return as-is
    if (isPixEmvcoQr(trimmed)) {
        return trimmed
    }

    // Validate the PIX key first
    const validation = validatePixKey(trimmed)
    if (!validation.valid) {
        return null
    }

    // Generate BR Code using pix-utils
    // merchantName is the PIX key itself (truncated to 25 chars per EMVCo spec)
    // Note: transactionAmount is optional at runtime despite TypeScript types
    const pix = createStaticPix({
        merchantName: trimmed.substring(0, 25),
        merchantCity: 'Sao Paulo',
        pixKey: trimmed,
    } as Parameters<typeof createStaticPix>[0])

    if (hasError(pix)) {
        return null
    }

    return pix.toBRCode()
}
