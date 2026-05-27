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

import {
    listContentSlugs,
    listCorridorOrigins,
    readCorridorContent,
    readPageContent,
    readPageContentLocalized,
} from '@/lib/content'
import type { Locale } from '@/i18n/types'
import { displayNameFromContent } from './utils'

export interface CountrySEO {
    name: string
}

export interface Corridor {
    from: string
    to: string
}

function loadCountries(): Record<string, CountrySEO> {
    const result: Record<string, CountrySEO> = {}
    for (const slug of listContentSlugs('countries')) {
        // A slug directory with no en.md has no render target — the route
        // would 404. Gate on content presence, not just directory existence.
        const content = readPageContent<{ name?: unknown; published?: boolean }>('countries', slug, 'en')
        if (!content || content.frontmatter.published === false) continue
        result[slug] = { name: displayNameFromContent(slug, content.frontmatter) }
    }
    return result
}

function loadCorridors(): Corridor[] {
    const seen = new Set<string>()
    const corridors: Corridor[] = []
    for (const dest of listContentSlugs('send-to')) {
        for (const origin of listCorridorOrigins(dest)) {
            // Skip corridor dirs with no en.md — send-money-from would 404.
            const content = readCorridorContent<{ published?: boolean }>(dest, origin, 'en')
            if (!content || content.frontmatter.published === false) continue
            const key = `${origin}→${dest}`
            if (seen.has(key)) continue
            seen.add(key)
            corridors.push({ from: origin, to: dest })
        }
    }
    return corridors
}

/**
 * Origins for the receive-money-from pages. The set is the corridor origins,
 * but only those that actually have a receive-from article — an origin present
 * in CORRIDORS.from but missing content/receive-from/{slug}/en.md would 404
 * (this is how colombia & mexico shipped as live 404s in May 2026). The
 * receive-from content tree is authored independently of corridors, so the two
 * sets don't line up automatically.
 */
function loadReceiveSources(corridors: Corridor[]): string[] {
    const origins = [...new Set(corridors.map((c) => c.from))]
    return origins.filter((slug) => {
        const content = readPageContent<{ published?: boolean }>('receive-from', slug, 'en')
        return content !== null && content.frontmatter.published !== false
    })
}

export const COUNTRIES_SEO: Record<string, CountrySEO> = loadCountries()
export const CORRIDORS: Corridor[] = loadCorridors()
export const RECEIVE_SOURCES: string[] = loadReceiveSources(CORRIDORS)

/**
 * Get the country display name for a slug at the given locale. Reads
 * `frontmatter.name` from content/countries/{slug}/{locale}.md via the
 * standard locale fallback chain; falls back to title-casing the slug.
 */
export function getCountryName(slug: string, locale: Locale): string {
    const content = readPageContentLocalized<{ name?: unknown }>('countries', slug, locale)
    return displayNameFromContent(slug, content?.frontmatter)
}
