import { type CountryData } from '@/components/AddMoney/consts'

/**
 * Country names in `countryData` are English catalog copy. The platform already
 * ships every translation through `Intl.DisplayNames`, so the localized name is
 * derived from the ISO-2 code at render time — the message catalogs never carry
 * ~250 country names per locale.
 */
const displayNamesByLocale = new Map<string, Intl.DisplayNames | null>()

function regionDisplayNames(locale: string): Intl.DisplayNames | null {
    const cached = displayNamesByLocale.get(locale)
    if (cached !== undefined) return cached
    let instance: Intl.DisplayNames | null = null
    try {
        instance = new Intl.DisplayNames([locale], { type: 'region' })
    } catch {
        instance = null
    }
    displayNamesByLocale.set(locale, instance)
    return instance
}

/**
 * "BR" → "Brasil" in pt-BR. Falls back to `fallback` when the code is missing or
 * unmappable — `Intl.DisplayNames.of` echoes the input code back for anything it
 * does not know, which would show "XK" where a name belongs.
 */
export function localizedCountryName(locale: string, iso2: string | undefined, fallback: string): string {
    if (!iso2) return fallback
    let name: string | undefined
    try {
        name = regionDisplayNames(locale)?.of(iso2)
    } catch {
        return fallback
    }
    return name && name.toUpperCase() !== iso2.toUpperCase() ? name : fallback
}

/**
 * `localizedCountryName` for a catalog entry. Every `type: 'country'` entry
 * carries `iso2`; the one entry without it is the `crypto` pseudo-country, which
 * correctly keeps its own title.
 */
export function localizedCountryTitle(locale: string, country: Pick<CountryData, 'iso2' | 'title'>): string {
    return localizedCountryName(locale, country.iso2, country.title)
}
