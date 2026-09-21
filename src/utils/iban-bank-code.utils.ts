/**
 * Reading the bank out of an IBAN.
 *
 * An IBAN is `CC` + two check digits + a national basic account number (BBAN).
 * The BBAN starts with an identifier for the bank, and both its position and
 * its length are set by each country. This file holds those rules and the
 * mod-97 check, so the BIC lookup never has to guess where the bank ends and
 * the account begins.
 */

/**
 * Where the bank identifier sits inside the BBAN, by IBAN country code.
 *
 * `offset` skips a national check character that comes before the bank code —
 * Italy and San Marino put a CIN letter there. `length` is the bank
 * identifier alone: a branch or account digit in the key would make one bank
 * look like hundreds.
 *
 * Countries whose BBAN opens with the bank's four-letter SWIFT institution
 * code (GB, IE, MT, NL, and the rest) use `length: 4`, so one entry covers
 * every sort code that bank holds.
 */
export const BANK_CODE_POSITION: Readonly<Record<string, { offset: number; length: number }>> = {
    AD: { offset: 0, length: 4 },
    AT: { offset: 0, length: 5 },
    BE: { offset: 0, length: 3 },
    BG: { offset: 0, length: 4 },
    CH: { offset: 0, length: 5 },
    CY: { offset: 0, length: 3 },
    CZ: { offset: 0, length: 4 },
    DE: { offset: 0, length: 8 },
    DK: { offset: 0, length: 4 },
    EE: { offset: 0, length: 2 },
    ES: { offset: 0, length: 4 },
    FI: { offset: 0, length: 3 },
    FR: { offset: 0, length: 5 },
    GB: { offset: 0, length: 4 },
    GG: { offset: 0, length: 4 },
    GI: { offset: 0, length: 4 },
    GR: { offset: 0, length: 3 },
    HR: { offset: 0, length: 7 },
    HU: { offset: 0, length: 3 },
    IE: { offset: 0, length: 4 },
    IM: { offset: 0, length: 4 },
    IS: { offset: 0, length: 4 },
    IT: { offset: 1, length: 5 },
    JE: { offset: 0, length: 4 },
    LI: { offset: 0, length: 5 },
    LT: { offset: 0, length: 5 },
    LU: { offset: 0, length: 3 },
    LV: { offset: 0, length: 4 },
    MC: { offset: 0, length: 5 },
    MT: { offset: 0, length: 4 },
    NL: { offset: 0, length: 4 },
    NO: { offset: 0, length: 4 },
    // Poland's settlement number is eight digits, but only the first three name
    // the bank; the rest is the branch and a check digit.
    PL: { offset: 0, length: 3 },
    PT: { offset: 0, length: 4 },
    RO: { offset: 0, length: 4 },
    SE: { offset: 0, length: 3 },
    SI: { offset: 0, length: 2 },
    SK: { offset: 0, length: 4 },
    SM: { offset: 1, length: 5 },
    TR: { offset: 0, length: 5 },
    VA: { offset: 0, length: 3 },
}

/** Strip spacing and punctuation, and upper-case. */
export function normalizeIban(iban: string): string {
    return (iban ?? '').replace(/[^A-Za-z0-9]/g, '').toUpperCase()
}

/**
 * Does this string have the shape of an IBAN and pass the ISO 7064 mod-97
 * check? Length is checked loosely, because per-country lengths change as
 * countries join, and the caller already asks the backend for a full
 * validation before it trusts anything.
 */
export function hasValidIbanChecksum(iban: string): boolean {
    const normalized = normalizeIban(iban)
    if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{10,30}$/.test(normalized)) return false

    const rearranged = normalized.slice(4) + normalized.slice(0, 4)
    let remainder = 0
    for (const character of rearranged) {
        const value = character >= 'A' ? character.charCodeAt(0) - 55 : Number(character)
        // Fold digit by digit: the whole number overflows Number for a long IBAN.
        remainder = value > 9 ? (remainder * 100 + value) % 97 : (remainder * 10 + value) % 97
    }
    return remainder === 1
}

/** The IBAN's country code, or null if the string does not start with one. */
export function getIbanCountry(iban: string): string | null {
    const country = normalizeIban(iban).slice(0, 2)
    return /^[A-Z]{2}$/.test(country) ? country : null
}

/**
 * The bank identifier inside an IBAN, or null when the country has no rule
 * here or the IBAN is too short to hold one.
 */
export function getIbanBankCode(iban: string): string | null {
    const normalized = normalizeIban(iban)
    const country = getIbanCountry(normalized)
    if (!country) return null

    const position = BANK_CODE_POSITION[country]
    if (!position) return null

    const start = 4 + position.offset
    const bankCode = normalized.slice(start, start + position.length)
    return bankCode.length === position.length ? bankCode : null
}
