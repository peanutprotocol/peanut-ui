import { isAddress } from 'viem'
import { isIBAN } from 'validator'
import { isValidRoutingNumber, isValidSortCode, isValidUKAccountNumber } from '@/utils/bridge-accounts.utils'
import {
    isPixEmvcoQr,
    normalizePixInput,
    validateCbuCvuAlias,
    validateMXCLabeAccount,
    validatePixKey,
    validateUSBankAccount,
} from '@/utils/withdraw.utils'

export type PasteFieldKind =
    | 'evmAddress'
    | 'iban'
    | 'bic'
    | 'routingNumber'
    | 'usAccount'
    | 'ukSortCode'
    | 'ukAccount'
    | 'clabe'
    | 'cbuCvuAlias'
    | 'pixKey'
    | 'recipient'

const BIC_REGEX = /^[A-Za-z]{4}[A-Za-z]{2}[A-Za-z0-9]{2}([A-Za-z0-9]{3})?$/

const firstMatch = (text: string, regex: RegExp, accept: (candidate: string) => string | null): string | null => {
    for (const match of text.matchAll(regex)) {
        const accepted = accept(match[0])
        if (accepted) return accepted
    }
    return null
}

const digitGroups = (text: string): string[] => text.match(/\d+/g) ?? []

/**
 * Finds the relevant payment token inside arbitrary pasted text and returns it cleaned,
 * or null when nothing in the text validates for the given field kind. Synchronous on
 * purpose: a paste handler must call preventDefault() before any await, so all validators
 * used here are synchronous (validateIban is just isIBAN, which we import directly).
 */
export function extractPaymentValue(text: string, kind: PasteFieldKind): string | null {
    switch (kind) {
        case 'evmAddress':
            return firstMatch(text, /0x[a-fA-F0-9]{40}/g, (c) => (isAddress(c) ? c : null))

        case 'recipient': {
            const evm = firstMatch(text, /0x[a-fA-F0-9]{40}/g, (c) => (isAddress(c) ? c : null))
            if (evm) return evm
            return firstMatch(text, /[A-Za-z]{2}\d{2}[A-Za-z0-9 ]{11,}/g, (c) => {
                const cleaned = c.replace(/\s+/g, '').toUpperCase()
                for (let len = Math.min(cleaned.length, 34); len >= 15; len--) {
                    const prefix = cleaned.slice(0, len)
                    if (isIBAN(prefix)) return prefix
                }
                return null
            })
        }

        case 'iban':
            return firstMatch(text, /[A-Za-z]{2}\d{2}[A-Za-z0-9 ]{11,}/g, (c) => {
                const cleaned = c.replace(/\s+/g, '').toUpperCase()
                // Trailing words can get glued on, so return the longest valid IBAN prefix.
                for (let len = Math.min(cleaned.length, 34); len >= 15; len--) {
                    const prefix = cleaned.slice(0, len)
                    if (isIBAN(prefix)) return prefix
                }
                return null
            })

        case 'bic':
            // BICs are conventionally uppercase; requiring uppercase avoids matching prose words.
            return firstMatch(text, /\b[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?\b/g, (c) =>
                BIC_REGEX.test(c) ? c : null
            )

        case 'routingNumber':
            return digitGroups(text).find((g) => g.length === 9 && isValidRoutingNumber(g)) ?? null

        case 'usAccount':
            return digitGroups(text).find((g) => validateUSBankAccount(g).isValid) ?? null

        case 'ukSortCode':
            return firstMatch(text, /\d{2}[- ]?\d{2}[- ]?\d{2}/g, (c) => {
                const cleaned = c.replace(/[- ]/g, '')
                return isValidSortCode(cleaned) ? cleaned : null
            })

        case 'ukAccount':
            return digitGroups(text).find((g) => isValidUKAccountNumber(g)) ?? null

        case 'clabe':
            return digitGroups(text).find((g) => g.length === 18 && validateMXCLabeAccount(g).isValid) ?? null

        case 'cbuCvuAlias': {
            const cbuCvu = digitGroups(text).find((g) => g.length === 22 && validateCbuCvuAlias(g).valid)
            if (cbuCvu) return cbuCvu
            return firstMatch(text, /[A-Za-z\d.-]{6,20}/g, (c) => (validateCbuCvuAlias(c).valid ? c : null))
        }

        case 'pixKey':
            return extractPixKey(text)

        default:
            return null
    }
}

function extractPixKey(text: string): string | null {
    const trimmed = text.trim()

    if (isPixEmvcoQr(trimmed) && validatePixKey(trimmed).valid) return trimmed

    const candidates = [
        text.match(/[^\s@]+@[^\s@]+\.[^\s@]+/)?.[0],
        text.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0],
        text.match(/\+?55[\s-]?\d{2}[\s-]?\d{4,5}[\s-]?\d{4}/)?.[0],
        ...digitGroups(text).filter((g) => g.length === 11 || g.length === 14),
    ]

    for (const candidate of candidates) {
        if (!candidate) continue
        const normalized = normalizePixInput(candidate)
        if (validatePixKey(normalized).valid) return normalized
    }
    return null
}

/**
 * Builds an onPaste handler that, when the clipboard contains a recognizable payment
 * token for `kind`, replaces the field with just that token. Falls through to the
 * browser's normal paste when nothing validates, so behavior is unchanged otherwise.
 */
export function createSmartPasteHandler(
    kind: PasteFieldKind,
    applyValue: (value: string) => void
): React.ClipboardEventHandler<HTMLInputElement> {
    return (e) => {
        const text = e.clipboardData?.getData('text') ?? ''
        if (!text) return
        const extracted = extractPaymentValue(text, kind)
        if (extracted && extracted !== text) {
            e.preventDefault()
            applyValue(extracted)
        }
    }
}
