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
 * its check digits. A masked one ("12*******90": first 2 and last 2 digits
 * kept, one asterisk per hidden digit) can only be classified by its length.
 */
export function brTaxIdKind(value: string): BrTaxIdKind | null {
    if (isValidCpf(value)) return 'CPF'
    if (isValidCnpj(value)) return 'CNPJ'
    if (!/^\d{2}\*+\d{2}$/.test(value)) return null
    if (value.length === 11) return 'CPF'
    if (value.length === 14) return 'CNPJ'
    return null
}

/** 095.799.271-89 for a CPF, 12.345.678/0001-95 for a CNPJ; any other value unchanged. */
export function formatBrTaxId(value: string): string {
    if (isValidCpf(value)) return value.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
    if (isValidCnpj(value)) return value.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
    return value
}
