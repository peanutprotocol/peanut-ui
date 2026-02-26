// Unified content loader for peanutprotocol/peanut-content.
//
// Two read paths:
//   readEntityData(category, slug)      → input/data/{category}/{slug}.md (frontmatter only)
//   readPageContent(intent, slug, lang) → content/{intent}/{slug}/{lang}.md (frontmatter + body)
//
// Discovers entities by scanning directories. No _index.yaml dependency.
// Implements locale fallback chains per BCP 47 codes.

import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'

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

const entityCache = new Map<string, unknown>()
const pageCache = new Map<string, unknown>()

// --- Core types ---

export interface MarkdownContent<T = Record<string, unknown>> {
    frontmatter: T
    body: string
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

// --- Entity data readers (input/data/{category}/{slug}.md) ---

/** Read structured entity data from input/data/{category}/{slug}.md */
export function readEntityData<T = Record<string, unknown>>(category: string, slug: string): MarkdownContent<T> | null {
    const key = `entity:${category}/${slug}`
    if (!isDev && entityCache.has(key)) return entityCache.get(key) as MarkdownContent<T> | null

    const filePath = path.join(CONTENT_ROOT, 'input/data', category, `${slug}.md`)
    const result = parseMarkdownFile<T>(filePath)
    entityCache.set(key, result)
    return result
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

/** List all entity slugs in a category by scanning input/data/{category}/ */
export function listEntitySlugs(category: string): string[] {
    const dir = path.join(CONTENT_ROOT, 'input/data', category)
    try {
        return fs
            .readdirSync(dir)
            .filter((f) => f.endsWith('.md') && f !== 'README.md')
            .map((f) => f.replace('.md', ''))
    } catch {
        return []
    }
}

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

/** List available locales for a content page */
export function listPageLocales(intent: string, slug: string): string[] {
    const dir = path.join(CONTENT_ROOT, 'content', intent, slug)
    try {
        return fs
            .readdirSync(dir)
            .filter((f) => f.endsWith('.md'))
            .map((f) => f.replace('.md', ''))
    } catch {
        return []
    }
}

/** Check if a page content file exists for the given locale (no fallback) */
export function pageLocaleExists(intent: string, slug: string, locale: string): boolean {
    return fs.existsSync(path.join(CONTENT_ROOT, 'content', intent, slug, `${locale}.md`))
}

// --- Publication status ---

interface PublishableContent {
    published?: boolean
}

/** Check if content is published (defaults to false if field missing) */
export function isPublished(content: MarkdownContent<PublishableContent> | null): boolean {
    if (!content) return false
    return content.frontmatter.published === true
}

/** List published content slugs for an intent */
export function listPublishedSlugs(intent: string): string[] {
    return listContentSlugs(intent).filter((slug) => {
        const content = readPageContent<PublishableContent>(intent, slug, 'en')
        return isPublished(content)
    })
}
