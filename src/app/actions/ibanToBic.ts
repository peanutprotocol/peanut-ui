// @ts-expect-error: CommonJS module without types
import { ibanToBic } from 'iban-to-bic'
import { SUPPLEMENTARY_BIC_BY_BANK_CODE } from '@/constants/iban-bic.consts'
import { getIbanBankCode, getIbanCountry, hasValidIbanChecksum, normalizeIban } from '@/utils/iban-bank-code.utils'

/**
 * The BIC for an IBAN, or null when we cannot name the bank.
 *
 * Two sources, in order. `iban-to-bic` carries the official bank registers for
 * Austria, Belgium, Germany, Spain, France, Luxembourg and the Netherlands and
 * answers first, so nothing it already knew changes.
 * `SUPPLEMENTARY_BIC_BY_BANK_CODE` covers the countries it has no register for,
 * plus the few Spanish and French banks its registers predate. That gap was 89
 * of 195 production accounts, Lithuania and the United Kingdom among them.
 *
 * Returns null rather than throwing, and rather than guessing. The caller shows
 * the BIC field so the user can enter it, and a BIC that is merely plausible
 * would send someone's money to the wrong bank.
 */
export async function getBicFromIban(iban: string): Promise<string | null> {
    const normalized = normalizeIban(iban)
    if (!hasValidIbanChecksum(normalized)) return null

    try {
        const registered = ibanToBic(normalized)
        if (typeof registered === 'string' && registered) return registered.toUpperCase()
    } catch (error) {
        // A throw here is the package failing, not the bank being unknown, so
        // fall through to the supplement rather than giving up on the IBAN.
        console.error('IBAN to BIC lookup failed', error)
    }

    const country = getIbanCountry(normalized)
    const bankCode = getIbanBankCode(normalized)
    if (!country || !bankCode) return null

    return SUPPLEMENTARY_BIC_BY_BANK_CODE[country]?.[bankCode] ?? null
}
