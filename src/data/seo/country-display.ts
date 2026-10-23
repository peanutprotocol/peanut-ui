import { readPageContentLocalized } from '@/lib/content'
import type { Locale } from '@/i18n/types'
import { countryData } from '@/components/AddMoney/consts'
import { localizedCountryName } from '@/utils/country-name.utils'
import { COUNTRIES_SEO } from './corridors'
import { displayNameFromContent, titleCaseSlug } from './utils'

/**
 * Lowercase ISO-2 code for a country slug: the hub's frontmatter when there is
 * a hub, else the app's country catalog, matched on its path.
 */
export function countryIso2(slug: string): string | undefined {
    const iso2 =
        COUNTRIES_SEO[slug]?.iso2 ??
        countryData.find((country) => country.type === 'country' && country.path === slug)?.iso2
    return iso2?.toLowerCase()
}

/**
 * Get the country display name for a slug at the given locale. Reads
 * `frontmatter.name` from content/countries/{slug}/{locale}.md via the
 * standard locale fallback chain. A country without a hub is named from its
 * ISO-2 code in the page language; title-casing the slug is the last resort.
 */
export function getCountryName(slug: string, locale: Locale): string {
    const content = readPageContentLocalized<{ name?: unknown }>('countries', slug, locale)
    if (content) return displayNameFromContent(slug, content.frontmatter)
    return localizedCountryName(locale, countryIso2(slug)?.toUpperCase(), titleCaseSlug(slug))
}
