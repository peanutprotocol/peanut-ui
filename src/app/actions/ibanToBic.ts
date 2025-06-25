'use server'

// @ts-ignore: CommonJS module without types
import { ibanToBic } from 'iban-to-bic'

/**
 * Given a valid IBAN, returns its BIC/SWIFT via the `iban-to-bic` package.
 * Throws if the IBAN is invalid.
 */
export async function getBicFromIban(iban: string): Promise<string> {
    try {
        return ibanToBic(iban)
    } catch (err) {
        console.error('IBAN→BIC conversion failed', err)
        throw new Error('Unable to derive BIC from IBAN')
    }
}
