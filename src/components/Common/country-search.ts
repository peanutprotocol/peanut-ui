import type { CountryData } from '@/components/AddMoney/consts'
import { normalizeSearch } from '@/features/paperwork-verification/occupations/search'

/**
 * Does a country answer this search?
 *
 * The English catalog title stays searchable beside the localized name, so
 * "Brazil" still finds "Brasil", and the currency code answers "eur".
 * `CountryList` applies it to its own field and to a term its caller owns (the
 * withdraw currency list), so both searches answer the same way.
 *
 * Case and accents do not count: "mexico" finds "México" and "méxico" finds
 * "Mexico", because people type the name without the accents the list shows.
 *
 * `term` is expected trimmed by the caller.
 */
export function matchesCountryQuery(country: CountryData, term: string, displayName: string): boolean {
    if (!term) return true
    const query = normalizeSearch(term)
    return (
        normalizeSearch(displayName).includes(query) ||
        normalizeSearch(country.title).includes(query) ||
        !!country.currency?.toLowerCase().includes(query)
    )
}
