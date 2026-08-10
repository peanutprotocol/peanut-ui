import type { Metadata } from 'next'
import { generateMetadata as metadataHelper } from '@/app/metadata'
import { BASE_URL } from '@/constants/general.consts'
import { getAlternatesFor, HREFLANG_MAP, OG_LOCALE_MAP, type Locale } from '@/i18n/config'
import {
    availableContentLocales,
    hasPageContent,
    listPublishedSlugs,
    readPageContent,
    type ContentFrontmatter,
    type MarkdownContent,
} from '@/lib/content'

export const SPLIT_GUIDE_INTENT = 'split-guides'
export const SPLIT_GUIDE_LOCALES = ['en', 'es-419', 'pt-br'] as const satisfies readonly Locale[]

export interface SplitGuideFrontmatter extends ContentFrontmatter {
    date: string | Date
    author?: string
}

export interface SplitGuideParam {
    locale: Locale
    slug: string
}

export interface SplitGuideSitemapRow extends SplitGuideParam {
    path: string
    alternates: { languages: Record<string, string> }
}

export function splitGuidePath(locale: Locale, slug: string): string {
    return `/${locale}/split/guides/${encodeURIComponent(slug)}`
}

export function splitGuideDate(frontmatter: { date?: unknown }): string | null {
    const { date } = frontmatter
    if (date instanceof Date) {
        return Number.isFinite(date.getTime()) ? date.toISOString().split('T')[0] : null
    }
    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
        const parsed = new Date(`${date}T00:00:00.000Z`)
        if (Number.isFinite(parsed.getTime()) && parsed.toISOString().split('T')[0] === date) return date
    }
    return null
}

export function isPublishedSplitGuide(
    content: MarkdownContent<SplitGuideFrontmatter> | null
): content is MarkdownContent<SplitGuideFrontmatter> {
    if (!content || !content.frontmatter || typeof content.frontmatter !== 'object') return false
    const frontmatter = content.frontmatter as unknown as Record<string, unknown>
    const { title, description, published } = frontmatter

    if (typeof title !== 'string' || !title.trim()) return false
    if (typeof description !== 'string' || !description.trim()) return false
    if (published !== undefined && typeof published !== 'boolean') return false
    if (published === false) return false
    return splitGuideDate(frontmatter) !== null
}

/** Read only the requested locale. Split guides never fall back to another locale. */
export function readPublishedSplitGuide(slug: string, locale: Locale): MarkdownContent<SplitGuideFrontmatter> | null {
    const content = readPageContent<SplitGuideFrontmatter>(SPLIT_GUIDE_INTENT, slug, locale)
    return isPublishedSplitGuide(content) ? content : null
}

/** Exact-file publication check shared by route params, hreflang and sitemap generation. */
export function hasPublishedSplitGuide(slug: string, locale: Locale): boolean {
    if (!hasPageContent(SPLIT_GUIDE_INTENT, slug, locale)) return false
    return readPublishedSplitGuide(slug, locale) !== null
}

export function buildSplitGuideParams(
    slugs: readonly string[],
    locales: readonly Locale[],
    hasExactPublishedGuide: (slug: string, locale: Locale) => boolean
): SplitGuideParam[] {
    // English owns publication for this family. A translated file can never
    // seed a route, hreflang cluster or sitemap row when its English source is
    // missing, unpublished or malformed.
    const englishPublishedSlugs = slugs.filter((slug) => hasExactPublishedGuide(slug, 'en'))
    return locales.flatMap((locale) =>
        englishPublishedSlugs.filter((slug) => hasExactPublishedGuide(slug, locale)).map((slug) => ({ locale, slug }))
    )
}

export function getSplitGuideStaticParams(): SplitGuideParam[] {
    return buildSplitGuideParams(listPublishedSlugs(SPLIT_GUIDE_INTENT), SPLIT_GUIDE_LOCALES, hasPublishedSplitGuide)
}

/** Locales shown in hreflang and the guide switcher; exact published files only. */
export function getAvailableSplitGuideLocales(slug: string): Locale[] {
    const availableLocales = new Set(availableContentLocales(SPLIT_GUIDE_INTENT, slug))
    return SPLIT_GUIDE_LOCALES.filter((locale) => availableLocales.has(locale) && hasPublishedSplitGuide(slug, locale))
}

export function buildSplitGuideAlternates(slug: string, locales: readonly Locale[]): Record<string, string> {
    return getAlternatesFor(locales, 'split', 'guides', slug)
}

export function buildSplitGuideSitemapRows(
    params: readonly SplitGuideParam[],
    availableLocalesFor: (slug: string) => readonly Locale[]
): SplitGuideSitemapRow[] {
    return params.map(({ locale, slug }) => ({
        locale,
        slug,
        path: splitGuidePath(locale, slug),
        alternates: { languages: buildSplitGuideAlternates(slug, availableLocalesFor(slug)) },
    }))
}

export function buildSplitGuideMetadata(
    frontmatter: SplitGuideFrontmatter,
    locale: Locale,
    slug: string,
    locales: readonly Locale[]
): Metadata {
    const canonical = splitGuidePath(locale, slug)
    const title = `${frontmatter.title} | Peanut`
    const baseMetadata = metadataHelper({
        locale,
        title,
        description: frontmatter.description,
        canonical,
        dynamicOg: true,
    })

    return {
        ...baseMetadata,
        openGraph: {
            ...baseMetadata.openGraph,
            locale: OG_LOCALE_MAP[locale],
            alternateLocale: locales
                .filter((candidate) => candidate !== locale)
                .map((candidate) => OG_LOCALE_MAP[candidate]),
        },
        alternates: {
            canonical,
            languages: buildSplitGuideAlternates(slug, locales),
        },
    }
}

export function buildSplitGuideBlogPosting(
    frontmatter: SplitGuideFrontmatter,
    locale: Locale,
    slug: string
): Record<string, unknown> {
    const url = `${BASE_URL}${splitGuidePath(locale, slug)}`
    const datePublished = splitGuideDate(frontmatter)

    return {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: frontmatter.title,
        description: frontmatter.description,
        datePublished,
        dateModified: datePublished,
        inLanguage: HREFLANG_MAP[locale],
        author: { '@type': 'Organization', name: frontmatter.author ?? 'Peanut' },
        publisher: { '@type': 'Organization', name: 'Peanut', url: BASE_URL },
        url,
        mainEntityOfPage: url,
    }
}
