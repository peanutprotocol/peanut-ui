// Country + corridor data for marketing routes, read from generated content.
//
// Sources (all in the public mirror):
//   content/countries/{slug}/{lang}.md      — country hub article + frontmatter
//   content/send-to/{dst}/from/{src}/{lang}.md — corridor article + frontmatter
//
// Country display names come from the `name:` field denormalized at
// generation time (see mono/content/_system/templates/country-hub.md); absent
// values fall through to title-casing. Locale-specific names are resolved via
// the standard locale fallback chain.
//
// The structured CountrySEO fields (currency, region, payment methods, FAQs,
// etc.) used to live here; they were retired in March 2026 when the rendering
// layer moved to MDX-as-prose (commits bd0e575, 1d04ee1). All four marketing
// routes — /{country}, /send-money-to, /receive-money-from, /send-money-from
// — now render the MDX body directly. We keep only the slug list and the
// display-name resolver.

import { listContentSlugs, listCorridorOrigins, readPageContent, readPageContentLocalized } from '@/lib/content'
import type { Locale } from '@/i18n/types'
import { displayNameFromContent } from './utils'

export interface CountrySEO {
    name: string
    /** ISO 3166-1 alpha-2 code, denormalized from the country entity into
     *  generated frontmatter. Drives flag rendering in DestinationGrid. */
    iso2?: string
}

export interface Corridor {
    from: string
    to: string
}

function loadCountries(): Record<string, CountrySEO> {
    const result: Record<string, CountrySEO> = {}
    for (const slug of listContentSlugs('countries')) {
        const content = readPageContent<{ name?: unknown; iso2?: unknown; published?: boolean }>(
            'countries',
            slug,
            'en'
        )
        if (content && content.frontmatter.published === false) continue
        const iso2 = typeof content?.frontmatter.iso2 === 'string' ? content.frontmatter.iso2 : undefined
        result[slug] = { name: displayNameFromContent(slug, content?.frontmatter), iso2 }
    }
    return result
}

function loadCorridors(): Corridor[] {
    const seen = new Set<string>()
    const corridors: Corridor[] = []
    for (const dest of listContentSlugs('send-to')) {
        for (const origin of listCorridorOrigins(dest)) {
            const key = `${origin}→${dest}`
            if (seen.has(key)) continue
            seen.add(key)
            corridors.push({ from: origin, to: dest })
        }
    }
    return corridors
}

export const COUNTRIES_SEO: Record<string, CountrySEO> = loadCountries()
export const CORRIDORS: Corridor[] = loadCorridors()

/**
 * Get the country display name for a slug at the given locale. Reads
 * `frontmatter.name` from content/countries/{slug}/{locale}.md via the
 * standard locale fallback chain; falls back to title-casing the slug.
 */
export function getCountryName(slug: string, locale: Locale): string {
    const content = readPageContentLocalized<{ name?: unknown }>('countries', slug, locale)
    return displayNameFromContent(slug, content?.frontmatter)
}
