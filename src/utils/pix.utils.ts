import { createStaticPix, hasError } from 'pix-utils'
import { validatePixKey, isPixEmvcoQr, normalizePixInput } from './withdraw.utils'
import { API_ERROR_CODES, apiErrorStatus, wireErrorCode } from '@/services/api-error'
import { brTaxIdKind, formatBrTaxId, type BrTaxIdKind } from './br-tax-id.utils'
import { SAVED_ADDRESS_NICKNAME_MAX } from './saved-address.utils'

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

    // The BR Code standard wants the key as the PIX directory holds it: digits
    // only for a CPF or CNPJ, +55 for a phone. A scanned or pasted key arrives
    // as typed ("123.456.789-09", "5511912345678").
    const key = normalizePixInput(trimmed)

    // Validate the PIX key first
    const validation = validatePixKey(key)
    if (!validation.valid) {
        return null
    }

    // Generate BR Code using pix-utils
    // merchantName is the PIX key itself (truncated to 25 chars per EMVCo spec)
    // Note: transactionAmount is optional at runtime despite TypeScript types
    const pix = createStaticPix({
        merchantName: key.substring(0, 25),
        merchantCity: 'Sao Paulo',
        pixKey: key,
    } as Parameters<typeof createStaticPix>[0])

    if (hasError(pix)) {
        return null
    }

    return pix.toBRCode()
}

/**
 * Wraps a raw PIX key into a `/qr-pay` redirect URL — the Manteca QR-payment
 * flow (send to any PIX key), as opposed to the offramp/withdraw endpoint.
 * Returns null when the key is invalid so callers can surface an error.
 *
 * Single source of truth for the scanner's PIX_KEY branch and the
 * withdraw/send PIX-key entry, so both reach the exact same `/qr-pay` flow.
 */
export const pixKeyToQrPayUrl = (pixKey: string): string | null => {
    const brCode = pixKeyToBRCode(pixKey)
    if (!brCode) return null
    const timestamp = Date.now()
    // type=PIX mirrors EQrType.PIX; qr-pay routes it to the Manteca PIX rail.
    const keyParam = isPixEmvcoQr(pixKey.trim()) ? '' : `&pixKey=${encodeURIComponent(normalizePixInput(pixKey))}`
    return `/qr-pay?qrCode=${encodeURIComponent(brCode)}&t=${timestamp}&type=PIX${keyParam}`
}

/** The key a `/qr-pay` URL names, in its directory form, when it is the key the BR Code pays. */
export function verifiedPixKeyLabel(qrCode: string, pixKey: string | null): string | null {
    if (!pixKey) return null
    const key = normalizePixInput(pixKey)
    return pixKeyToBRCode(key) === qrCode ? key : null
}

/**
 * The PIX key lookup failed because the key does not exist. Any other lookup
 * failure only means no owner name is available, and the payment can go ahead.
 */
export function isPixKeyNotFound(error: unknown): boolean {
    return apiErrorStatus(error) === 404 && wireErrorCode(error) === API_ERROR_CODES.PAYMENT_DESTINATION_NOT_FOUND
}

/**
 * What to show under a PIX key owner's name. A CPF or CNPJ key is the owner's
 * own tax ID, typed in full by the user, so it shows once and unmasked. Any
 * other key shows next to the owner's masked tax ID. A tax ID whose kind cannot
 * be told is left out rather than labelled "CPF/CNPJ".
 */
export function pixKeyOwnerDetails(
    pixKey: string,
    legalIdMasked: string | null
): { pixKey: string | null; taxId: { kind: BrTaxIdKind; value: string } | null } {
    const keyKind = brTaxIdKind(pixKey)
    if (keyKind) return { pixKey: null, taxId: { kind: keyKind, value: formatBrTaxId(pixKey) } }
    const maskedKind = legalIdMasked ? brTaxIdKind(legalIdMasked) : null
    return {
        pixKey,
        taxId: maskedKind && legalIdMasked ? { kind: maskedKind, value: legalIdMasked } : null,
    }
}

/**
 * The name offered when saving a PIX key: the owner's whole name when it fits
 * the address book's cap, otherwise their first name, cut to fit.
 */
export function defaultPixKeyNickname(ownerName: string): string {
    const name = ownerName.trim().replace(/\s+/g, ' ')
    if (name.length <= SAVED_ADDRESS_NICKNAME_MAX) return name
    return name.split(' ')[0].slice(0, SAVED_ADDRESS_NICKNAME_MAX)
}
