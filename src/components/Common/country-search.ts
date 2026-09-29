import type { CountryData } from '@/components/AddMoney/consts'

/**
 * Does a country answer this search?
 *
 * The English catalog title stays searchable beside the localized name, so
 * "Brazil" still finds "Brasil", and the currency code answers "eur".
 * `CountryList` applies it to its own field and to a term its caller owns (the
 * withdraw currency list), so both searches answer the same way.
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
