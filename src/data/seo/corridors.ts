// Typed wrappers for corridor/country SEO data.
// Reads from peanut-content: input/data/countries/ + content/countries/ + content/send-to/
// Public API unchanged from previous version.

import {
    readEntityData,
    readPageContent,
    readPageContentLocalized,
    listEntitySlugs,
    listContentSlugs,
    listCorridorOrigins,
    isPublished,
} from '@/lib/content'
import type { Locale } from '@/i18n/types'
import { extractFaqs } from './utils'

// --- Entity frontmatter schema (input/data/countries/{slug}.md) ---

interface CountryEntityFrontmatter {
    slug: string
    name: string
    currency: string
    local_id: string
    local_payment_methods: string[]
    corridors: Array<{
        origin: string
        priority: 'high' | 'medium' | 'low'
        common_use_cases: string[]
    }>
}

// --- Content frontmatter schema (content/countries/{slug}/{lang}.md) ---

interface CountryContentFrontmatter {
    title: string
    description: string
    slug: string
    lang: string
    published: boolean
    schema_types: string[]
    alternates?: Record<string, string>
}

// --- Spending method entity frontmatter ---

interface SpendingMethodFrontmatter {
    slug: string
    name: string
    type: string
}

// --- Public types (matches fields consumed by page components) ---

export interface CountrySEO {
    name: string
    region: string
    currency: string
    localPaymentMethods: string[]
    context: string
    instantPayment?: string
    payMerchants: boolean
    faqs: Array<{ q: string; a: string }>
    corridors: Array<{
        origin: string
        priority: 'high' | 'medium' | 'low'
    }>
}

export interface Corridor {
    from: string
    to: string
}

// --- Loader ---

function loadAll() {
    const countrySlugs = listEntitySlugs('countries')
    const countries: Record<string, CountrySEO> = {}
    const corridors: Corridor[] = []
    const publishedCountries = new Set<string>()

    // First pass: determine which countries have published content pages
    const contentSlugs = listContentSlugs('countries')
    for (const slug of contentSlugs) {
        const content = readPageContent<CountryContentFrontmatter>('countries', slug, 'en')
        if (content && isPublished(content)) {
            publishedCountries.add(slug)
        }
    }

    // If no published content yet, treat all countries with entity data + content as available
    // This allows the site to work during the transition period when published: false
    if (publishedCountries.size === 0) {
        for (const slug of contentSlugs) {
            const content = readPageContent<CountryContentFrontmatter>('countries', slug, 'en')
            if (content) publishedCountries.add(slug)
        }
    }

    for (const slug of countrySlugs) {
        if (!publishedCountries.has(slug)) continue

        const entity = readEntityData<CountryEntityFrontmatter>('countries', slug)
        if (!entity) continue

        const content = readPageContent<CountryContentFrontmatter>('countries', slug, 'en')
        const fm = entity.frontmatter

        // Resolve the first local payment method name for instantPayment display
        const paymentMethods = fm.local_payment_methods ?? []
        let instantPayment: string | undefined
        let payMerchants = false

        if (paymentMethods.length > 0) {
            const methodEntity = readEntityData<SpendingMethodFrontmatter>('spending-methods', paymentMethods[0])
            instantPayment = methodEntity?.frontmatter.name ?? paymentMethods[0]
            // QR-type methods support merchant payments
            payMerchants = methodEntity?.frontmatter.type === 'qr'
        }

        // Extract FAQs from the content body
        const faqs = content ? extractFaqs(content.body) : []

        countries[slug] = {
            name: fm.name,
            region: inferRegion(slug),
            currency: fm.currency,
            localPaymentMethods: paymentMethods,
            context: content?.body ?? '',
            instantPayment,
            payMerchants,
            faqs,
            corridors: fm.corridors?.map((c) => ({ origin: c.origin, priority: c.priority })) ?? [],
        }

        // Build corridors from entity data (some entities use destination: instead of origin:, skip those)
        if (fm.corridors) {
            for (const corridor of fm.corridors) {
                if (corridor.origin) {
                    corridors.push({ from: corridor.origin, to: slug })
                }
            }
        }
    }

    // Also add corridors discovered from content/send-to/{dest}/from/{origin}/
    for (const dest of listContentSlugs('send-to')) {
        for (const origin of listCorridorOrigins(dest)) {
            if (!corridors.some((c) => c.from === origin && c.to === dest)) {
                corridors.push({ from: origin, to: dest })
            }
        }
    }

    // Deduplicate corridors
    const seen = new Set<string>()
    const uniqueCorridors = corridors.filter((c) => {
        const key = `${c.from}→${c.to}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
    })

    return { countries, corridors: uniqueCorridors }
}

/** Infer region from slug — simple heuristic based on known country lists */
function inferRegion(slug: string): string {
    const latam = [
        'argentina',
        'brazil',
        'mexico',
        'colombia',
        'chile',
        'peru',
        'costa-rica',
        'panama',
        'bolivia',
        'guatemala',
    ]
    const northAmerica = ['united-states', 'canada']
    const asiaOceania = [
        'australia',
        'philippines',
        'japan',
        'india',
        'indonesia',
        'malaysia',
        'singapore',
        'thailand',
        'vietnam',
        'pakistan',
        'saudi-arabia',
        'united-arab-emirates',
    ]
    const africa = ['kenya', 'nigeria', 'south-africa', 'tanzania']

    if (latam.includes(slug)) return 'latam'
    if (northAmerica.includes(slug)) return 'north-america'
    if (asiaOceania.includes(slug)) return 'asia-oceania'
    if (africa.includes(slug)) return 'africa'
    return 'europe'
}

const _loaded = loadAll()

export const COUNTRIES_SEO: Record<string, CountrySEO> = _loaded.countries
export const CORRIDORS: Corridor[] = _loaded.corridors

/** Get country SEO data with locale-specific content (falls back via chain) */
export function getLocalizedSEO(country: string, locale: Locale): CountrySEO | null {
    const base = COUNTRIES_SEO[country]
    if (!base) return null
    if (locale === 'en') return base

    const localized = readPageContentLocalized<CountryContentFrontmatter>('countries', country, locale)
    if (!localized) return base

    const localizedFaqs = extractFaqs(localized.body)

    return {
        ...base,
        context: localized.body,
        faqs: localizedFaqs.length > 0 ? localizedFaqs : base.faqs,
    }
}

/** Get localized country display name */
export function getCountryName(slug: string, _locale: Locale): string {
    // Read name from entity data
    const entity = readEntityData<CountryEntityFrontmatter>('countries', slug)
    if (entity) return entity.frontmatter.name

    // Fallback: title-case the slug
    return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}
