/**
 * Territories whose banks issue IBANs under another country's code, by that
 * IBAN code. A BIC carries the territory's own code (characters 5-6), so these
 * pairs are valid and must not read as a mismatch.
 */
const IBAN_COUNTRY_ALSO_COVERS: Record<string, readonly string[]> = {
    FR: ['GP', 'MQ', 'GF', 'RE', 'YT', 'PM', 'BL', 'MF', 'NC', 'PF', 'WF', 'MC'],
    GB: ['JE', 'GG', 'IM', 'GI'],
    FI: ['AX'],
    ES: ['IC', 'EA'],
    PT: ['AZ', 'MD'],
    IT: ['SM', 'VA'],
}

/**
 * Does a BIC the user typed belong to the country the IBAN names?
 *
 * A cheap check for an obvious mismatch: a German IBAN with a Spanish bank's
 * BIC is a transfer the provider rejects after the user has confirmed it. It
 * answers true whenever it cannot tell, so it never blocks a pair it does not
 * understand.
 */
export function bicMatchesIbanCountry(bic: string, iban: string): boolean {
    const bicCountry = bic.replace(/\s/g, '').slice(4, 6).toUpperCase()
    const ibanCountry = iban.replace(/\s/g, '').slice(0, 2).toUpperCase()
    if (!/^[A-Z]{2}$/.test(bicCountry) || !/^[A-Z]{2}$/.test(ibanCountry)) return true
    if (bicCountry === ibanCountry) return true
    return IBAN_COUNTRY_ALSO_COVERS[ibanCountry]?.includes(bicCountry) ?? false
}
