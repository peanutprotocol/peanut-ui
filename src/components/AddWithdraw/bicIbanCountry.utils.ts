/**
 * Territories whose banks issue IBANs under another country's code, by that
 * IBAN code. A BIC carries the territory's own code (characters 5-6), so these
 * pairs are ordinary and worth no remark at all.
 *
 * Only a territory with a country code of its own belongs here. The Azores and
 * Madeira have none — both are Portuguese subdivisions whose IBANs and BICs
 * already read `PT` — so listing them suppressed the note for genuinely foreign
 * BICs instead, which is the one pair it exists to point at.
 */
const IBAN_COUNTRY_ALSO_COVERS: Record<string, readonly string[]> = {
    FR: ['GP', 'MQ', 'GF', 'RE', 'YT', 'PM', 'BL', 'MF', 'NC', 'PF', 'WF', 'MC'],
    GB: ['JE', 'GG', 'IM', 'GI'],
    FI: ['AX'],
    IT: ['SM', 'VA'],
}

/**
 * Is the BIC registered somewhere other than the country the IBAN names?
 *
 * A hint, never a refusal. Passporting makes the pair routine across the EEA:
 * Revolut issues local Spanish, French, German and Irish IBANs under a
 * Lithuanian BIC (`REVOLT21`), and Wise issues Belgian ones under `TRWIBEB1`.
 * Refusing those locally left the user unable to submit an account that works,
 * with no way round it — where the only authority on a BIC is the provider,
 * which `validateBic` already asks before the form is accepted.
 *
 * Answers false whenever it cannot tell, so it never remarks on a pair it does
 * not understand.
 */
export function bicCountryDiffersFromIban(bic: string, iban: string): boolean {
    const bicCountry = bic.replace(/\s/g, '').slice(4, 6).toUpperCase()
    const ibanCountry = iban.replace(/\s/g, '').slice(0, 2).toUpperCase()
    if (!/^[A-Z]{2}$/.test(bicCountry) || !/^[A-Z]{2}$/.test(ibanCountry)) return false
    if (bicCountry === ibanCountry) return false
    return !(IBAN_COUNTRY_ALSO_COVERS[ibanCountry]?.includes(bicCountry) ?? false)
}
