export type BrTaxIdKind = 'CPF' | 'CNPJ'

/** Two mod-11 check digits over `digits`, with the weights the Receita Federal defines for each position. */
function hasValidCheckDigits(digits: string, weights: number[][]): boolean {
    return weights.every((w) => {
        const sum = w.reduce((acc, weight, i) => acc + Number(digits[i]) * weight, 0)
        const remainder = sum % 11
        return (remainder < 2 ? 0 : 11 - remainder) === Number(digits[w.length])
    })
}

const CPF_WEIGHTS = [
    [10, 9, 8, 7, 6, 5, 4, 3, 2],
    [11, 10, 9, 8, 7, 6, 5, 4, 3, 2],
]
const CNPJ_WEIGHTS = [
    [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
    [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
]

/** CPF: 11 digits, not all equal, two valid check digits. */
export function isValidCpf(value: string): boolean {
    return /^\d{11}$/.test(value) && !/^(\d)\1{10}$/.test(value) && hasValidCheckDigits(value, CPF_WEIGHTS)
}

/** CNPJ: 14 digits, not all equal, two valid check digits. */
export function isValidCnpj(value: string): boolean {
    return /^\d{14}$/.test(value) && !/^(\d)\1{13}$/.test(value) && hasValidCheckDigits(value, CNPJ_WEIGHTS)
}

/**
 * Which Brazilian tax ID a value is, or null. A full number is classified by
 * its check digits. A masked one can only be classified by its length: one
 * asterisk per hidden digit, whichever digits it keeps ("12*******90" from
 * Manteca, "111.***.***-35" as the Pix directory punctuates it, and Avenia's
 * "***.456.789-**", which hides the first digits).
 */
export function brTaxIdKind(value: string): BrTaxIdKind | null {
    if (isValidCpf(value)) return 'CPF'
    if (isValidCnpj(value)) return 'CNPJ'
    // a masked id, bare or punctuated: digits and asterisks, at least one of each
    const masked = value.replace(/[.\-/]/g, '')
    if (!/^[\d*]+$/.test(masked) || !masked.includes('*') || !/\d/.test(masked)) return null
    if (masked.length === 11) return 'CPF'
    if (masked.length === 14) return 'CNPJ'
    return null
}

/** 111.444.777-35 for a CPF, 12.345.678/0001-95 for a CNPJ; any other value unchanged. */
export function formatBrTaxId(value: string): string {
    if (isValidCpf(value)) return value.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
    if (isValidCnpj(value)) return value.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
    return value
}

/**
 * A saved CPF the API shows by its last four digits (`•••• 7735`), in the CPF's own shape:
 * `XXX.XXX.X77-35` (Aleks, 2026-11-18). Any other value unchanged.
 */
export function formatMaskedCpf(masked: string): string {
    const last = masked.match(/^[^\d]*(\d{4})$/)?.[1]
    return last ? `XXX.XXX.X${last.slice(0, 2)}-${last.slice(2)}` : masked
}
