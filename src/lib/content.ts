// Unified content loader for peanut-ui's src/content/ submodule
// (a downstream mirror of mono/content/, authored in peanutprotocol/mono —
// see mono/content/_system/ARCHITECTURE.md for the full system).
//
// Public API (all read from the mirror):
//   readPageContent(intent, slug, lang)         → content/{intent}/{slug}/{lang}.md
//   readPageContentLocalized(intent, slug, lang)→ same, with locale fallback chain
//   readSingletonContent(intent, lang)          → content/{intent}/{lang}.md
//   readCorridorContent(dst, src, lang)         → content/send-to/{dst}/from/{src}/{lang}.md
//   listContentSlugs(intent)                    → directory scan of content/{intent}/
//   listCorridorOrigins(dst)                    → directory scan of content/send-to/{dst}/from/
//   listPublishedSlugs(intent)                  → same as listContentSlugs, gated by frontmatter
//   listAllContent(locale)                      → cross-type aggregator for the /content hub
//
// Entity data (mono/content/_system/data/*) and product facts (mono/product/)
// are not in the mirror by design — see mono/CONTRIBUTING.md → Trust tiers.
// Anything peanut-ui needs from those trees must be denormalized into
// generated content frontmatter at generation time.
//
// Implements locale fallback chains per BCP 47 codes.

import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import type { Locale } from '@/i18n/types'

const CONTENT_ROOT = path.join(process.cwd(), 'src/content')

// --- Locale fallback chains ---
// es-ar → es-419 → en
// es-es → en
// pt-br → en
// es-419 → en

const FALLBACK_CHAINS: Record<string, string[]> = {
    en: [],
    'es-419': ['en'],
    'es-ar': ['es-419', 'en'],
    'es-es': ['es-419', 'en'],
    'pt-br': ['en'],
}

/** Get ordered list of locales to try (requested locale first, then fallbacks) */
export function getLocaleFallbacks(locale: string): string[] {
    return [locale, ...(FALLBACK_CHAINS[locale] ?? ['en'])]
}

// --- Caches ---
// In development, skip caching so content changes are picked up without restart.

const isDev = process.env.NODE_ENV === 'development'

const pageCache = new Map<string, unknown>()

// --- Core types ---

export interface MarkdownContent<T = Record<string, unknown>> {
    frontmatter: T
    body: string
}

/** Common frontmatter fields shared by all generated marketing content pages. */
export interface ContentFrontmatter {
    title: string
    description: string
    published?: boolean
    generated_at?: string
}

// --- Low-level readers ---

function parseMarkdownFile<T = Record<string, unknown>>(filePath: string): MarkdownContent<T> | null {
    try {
        const raw = fs.readFileSync(filePath, 'utf8')
        const { data, content } = matter(raw)
        return { frontmatter: data as T, body: content.trim() }
    } catch {
        return null
    }
}

// --- Page content readers (content/{intent}/{slug}/{lang}.md) ---

/** Read generated page content from content/{intent}/{slug}/{lang}.md */
export function readPageContent<T = Record<string, unknown>>(
    intent: string,
    slug: string,
    lang: string
): MarkdownContent<T> | null {
    const key = `page:${intent}/${slug}/${lang}`
    if (!isDev && pageCache.has(key)) return pageCache.get(key) as MarkdownContent<T> | null

    const filePath = path.join(CONTENT_ROOT, 'content', intent, slug, `${lang}.md`)
    const result = parseMarkdownFile<T>(filePath)
    pageCache.set(key, result)
    return result
}

/** Read page content with locale fallback */
export function readPageContentLocalized<T = Record<string, unknown>>(
    intent: string,
    slug: string,
    lang: string
): MarkdownContent<T> | null {
    for (const locale of getLocaleFallbacks(lang)) {
        const content = readPageContent<T>(intent, slug, locale)
        if (content) return content
    }
    return null
}

/** Read corridor content: content/send-to/{destination}/from/{origin}/{lang}.md */
export function readCorridorContent<T = Record<string, unknown>>(
    destination: string,
    origin: string,
    lang: string
): MarkdownContent<T> | null {
    const key = `corridor:${destination}/from/${origin}/${lang}`
    if (!isDev && pageCache.has(key)) return pageCache.get(key) as MarkdownContent<T> | null

    const filePath = path.join(CONTENT_ROOT, 'content/send-to', destination, 'from', origin, `${lang}.md`)
    const result = parseMarkdownFile<T>(filePath)
    pageCache.set(key, result)
    return result
}

/** Read corridor content with locale fallback */
export function readCorridorContentLocalized<T = Record<string, unknown>>(
    destination: string,
    origin: string,
    lang: string
): MarkdownContent<T> | null {
    for (const locale of getLocaleFallbacks(lang)) {
        const content = readCorridorContent<T>(destination, origin, locale)
        if (content) return content
    }
    return null
}

// --- Directory scanners (replaces _index.yaml) ---

/** List all content slugs for an intent by scanning content/{intent}/ */
export function listContentSlugs(intent: string): string[] {
    const dir = path.join(CONTENT_ROOT, 'content', intent)
    try {
        return fs.readdirSync(dir).filter((f) => {
            const stat = fs.statSync(path.join(dir, f))
            return stat.isDirectory()
        })
    } catch {
        return []
    }
}

/** List corridor origins for a destination: content/send-to/{destination}/from/ */
export function listCorridorOrigins(destination: string): string[] {
    const dir = path.join(CONTENT_ROOT, 'content/send-to', destination, 'from')
    try {
        return fs.readdirSync(dir).filter((f) => {
            const stat = fs.statSync(path.join(dir, f))
            return stat.isDirectory()
        })
    } catch {
        return []
    }
}

// --- Publication status ---

interface PublishableContent {
    published?: boolean
}

/** Check if content is published (defaults to true if field missing) */
export function isPublished(content: MarkdownContent<PublishableContent> | null): boolean {
    if (!content) return false
    return content.frontmatter.published !== false
}

/** List published content slugs for an intent */
export function listPublishedSlugs(intent: string): string[] {
    return listContentSlugs(intent).filter((slug) => {
        const content = readPageContent<PublishableContent>(intent, slug, 'en')
        return isPublished(content)
    })
}

// --- Singleton content readers (content/{intent}/{lang}.md — no slug subdir) ---

/** Read singleton content directly: content/{intent}/{lang}.md */
export function readSingletonContent<T = Record<string, unknown>>(
    intent: string,
    lang: string
): MarkdownContent<T> | null {
    const key = `singleton:${intent}/${lang}`
    if (!isDev && pageCache.has(key)) return pageCache.get(key) as MarkdownContent<T> | null

    const filePath = path.join(CONTENT_ROOT, 'content', intent, `${lang}.md`)
    const result = parseMarkdownFile<T>(filePath)
    pageCache.set(key, result)
    return result
}

/** Read singleton content with locale fallback */
export function readSingletonContentLocalized<T = Record<string, unknown>>(
    intent: string,
    lang: string
): MarkdownContent<T> | null {
    for (const locale of getLocaleFallbacks(lang)) {
        const content = readSingletonContent<T>(intent, locale)
        if (content) return content
    }
    return null
}

// --- Content hub: cross-intent listing ---

export type ContentItemType = 'blog' | 'stories' | 'use-cases' | 'compare'

export interface ContentItem {
    type: ContentItemType
    slug: string
    title: string
    description: string
    href: string
    /** Locale the file was actually resolved to (via fallback chain). v2 lang chip filters on this. */
    lang: Locale
    /** Blog-only — ISO date string for sorting. */
    date?: string
    tags?: string[]
}

interface HubFrontmatter {
    title?: string
    description?: string
    published?: boolean
    date?: string | Date
    tags?: string[]
}

function coerceDate(date: unknown): string | undefined {
    if (date instanceof Date) return date.toISOString().split('T')[0]
    if (typeof date === 'string' && date) return date
    return undefined
}

function hrefFor(type: ContentItemType, slug: string, locale: Locale): string {
    if (type === 'compare') return `/${locale}/compare/peanut-vs-${encodeURIComponent(slug)}`
    return `/${locale}/${type}/${encodeURIComponent(slug)}`
}

/** Resolve a content page through the locale fallback chain, returning which locale was used. */
function resolveLocalized(
    intent: string,
    slug: string,
    lang: Locale
): { content: MarkdownContent<HubFrontmatter>; lang: Locale } | null {
    for (const locale of getLocaleFallbacks(lang)) {
        const content = readPageContent<HubFrontmatter>(intent, slug, locale)
        if (content) return { content, lang: locale as Locale }
    }
    return null
}

const HUB_TYPES: ContentItemType[] = ['blog', 'stories', 'use-cases', 'compare']

/**
 * Collect a single ContentItem per (type, slug) for the given locale, resolved via the fallback
 * chain. Drops items where the frontmatter sets `published: false`. v1 ignores `item.lang`; v2
 * language chip filters on it.
 */
export function listAllContent(locale: Locale): ContentItem[] {
    const items: ContentItem[] = []

    for (const type of HUB_TYPES) {
        for (const slug of listContentSlugs(type)) {
            if (slug === 'index') continue // legacy stories/index/ directory
            const resolved = resolveLocalized(type, slug, locale)
            if (!resolved) continue
            const { content, lang } = resolved
            if (content.frontmatter.published === false) continue

            items.push({
                type,
                slug,
                title: content.frontmatter.title ?? slug,
                description: content.frontmatter.description ?? '',
                href: hrefFor(type, slug, locale),
                lang,
                date: type === 'blog' ? coerceDate(content.frontmatter.date) : undefined,
                tags: Array.isArray(content.frontmatter.tags) ? content.frontmatter.tags : undefined,
            })
        }
    }

    // Blog first (sorted by date desc), then stories/use-cases/compare alphabetical.
    const typeOrder: Record<ContentItemType, number> = { blog: 0, stories: 1, 'use-cases': 2, compare: 3 }
    return items.sort((a, b) => {
        if (a.type !== b.type) return typeOrder[a.type] - typeOrder[b.type]
        if (a.type === 'blog') {
            return new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime()
        }
        return a.title.localeCompare(b.title)
    })
}
