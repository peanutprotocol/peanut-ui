/**
 * Currency names in the catalog are English copy. The platform ships every
 * translation through `Intl.DisplayNames`, so the localized name is derived from
 * the ISO-4217 code at render time — the same way country names are, in
 * `country-name.utils.ts`.
 */
const displayNamesByLocale = new Map<string, Intl.DisplayNames | null>()

function currencyDisplayNames(locale: string): Intl.DisplayNames | null {
    const cached = displayNamesByLocale.get(locale)
    if (cached !== undefined) return cached
    let instance: Intl.DisplayNames | null = null
    try {
        instance = new Intl.DisplayNames([locale], { type: 'currency' })
    } catch {
        instance = null
    }
    displayNamesByLocale.set(locale, instance)
    return instance
}

/**
 * "GBP" → "Libra esterlina" in pt-BR. Falls back to `fallback` when the code is
 * missing or unknown: `Intl.DisplayNames.of` echoes an unknown code back, which
 * would print "XYZ" where a name belongs.
 *
 * The first letter is capitalised. CLDR writes Spanish and Portuguese currency
 * names in lower case ("dólar estadounidense"), and these names stand alone as a
 * row's label, not inside a sentence.
 */
export function localizedCurrencyName(locale: string, code: string | undefined, fallback: string): string {
    if (!code) return fallback
    let name: string | undefined
    try {
        name = currencyDisplayNames(locale)?.of(code.toUpperCase())
    } catch {
        return fallback
    }
    if (!name || name.toUpperCase() === code.toUpperCase()) return fallback
    return name.charAt(0).toLocaleUpperCase(locale) + name.slice(1)
}
