// Typed wrappers for corridor/country SEO data.
// Reads from per-country directories: peanut-content/countries/<slug>/
// Public API unchanged from the previous monolithic JSON version.

import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { readEntitySeo, readEntityContent, readEntityIndex } from '@/lib/content'
import type { Locale } from '@/i18n/types'

const yaml = matter.engines.yaml
const countryNamesData = yaml.parse(
    fs.readFileSync(path.join(process.cwd(), 'src/content/i18n/country-names.yaml'), 'utf8')
) as Record<string, Record<string, string>>

export interface CountrySEO {
    region: 'latam' | 'north-america' | 'europe' | 'asia-oceania'
    context: string
    instantPayment?: string
    payMerchants: boolean
    faqs: Array<{ q: string; a: string }>
}

export interface Corridor {
    from: string
    to: string
}

interface CountrySeoJson {
    region: 'latam' | 'north-america' | 'europe' | 'asia-oceania'
    instantPayment: string | null
    payMerchants: boolean
    corridorsFrom: string[]
    corridorsTo: string[]
}

interface CountryFrontmatter {
    title: string
    description: string
    faqs: Array<{ q: string; a: string }>
}

interface CountryIndex {
    countries: Array<{ slug: string; region: string; locales: string[] }>
    corridors: Corridor[]
}

function loadAll() {
    const index = readEntityIndex<CountryIndex>('countries')
    if (!index) return { countries: {} as Record<string, CountrySEO>, corridors: [] as Corridor[] }

    const countries: Record<string, CountrySEO> = {}

    for (const { slug } of index.countries) {
        const seo = readEntitySeo<CountrySeoJson>('countries', slug)
        const content = readEntityContent<CountryFrontmatter>('countries', slug, 'en')
        if (!seo || !content) continue

        countries[slug] = {
            region: seo.region,
            context: content.body,
            instantPayment: seo.instantPayment ?? undefined,
            payMerchants: seo.payMerchants,
            faqs: content.frontmatter.faqs ?? [],
        }
    }

    return { countries, corridors: index.corridors }
}

const _loaded = loadAll()

export const COUNTRIES_SEO: Record<string, CountrySEO> = _loaded.countries
export const CORRIDORS: Corridor[] = _loaded.corridors

/** Get country SEO data with locale-specific content (falls back to English) */
export function getLocalizedSEO(country: string, locale: Locale): CountrySEO | null {
    const base = COUNTRIES_SEO[country]
    if (!base) return null
    if (locale === 'en') return base

    const localized = readEntityContent<CountryFrontmatter>('countries', country, locale)
    if (!localized) return base

    return {
        ...base,
        context: localized.body,
        faqs: localized.frontmatter.faqs ?? base.faqs,
    }
}

/** Get localized country display name */
export function getCountryName(slug: string, locale: Locale): string {
    const names = countryNamesData[slug]
    return names?.[locale] ?? slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}
