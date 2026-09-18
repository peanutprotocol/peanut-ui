import type { CountryData } from '@/components/AddMoney/consts'

/**
 * Does a country answer this search?
 *
 * The English catalog title stays searchable beside the localized name, so
 * "Brazil" still finds "Brasil", and the currency code answers "eur". One
 * predicate, because the deposit hub filters its account rows against the same
 * question the country list asks — two copies would disagree the first time
 * either changed.
 *
 * `term` is expected lower-cased and trimmed by the caller.
 */
export function matchesCountryQuery(country: CountryData, term: string, displayName: string): boolean {
    if (!term) return true
    return (
        displayName.toLowerCase().includes(term) ||
        country.title.toLowerCase().includes(term) ||
        !!country.currency?.toLowerCase().includes(term)
    )
}
