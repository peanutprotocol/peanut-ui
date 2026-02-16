// Unified content loader for per-entity content directories.
// Reads from peanut-content/{countries,exchanges,competitors}/<slug>/ structure.
// Parses YAML for data files and YAML frontmatter + Markdown body from .md files.

import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'

const CONTENT_ROOT = path.join(process.cwd(), 'src/content')

const yaml = matter.engines.yaml

// --- Low-level readers (cached per filepath for the lifetime of the process) ---

const yamlCache = new Map<string, unknown>()
const mdCache = new Map<string, unknown>()

function readYamlFile<T>(filePath: string): T | null {
    if (yamlCache.has(filePath)) return yamlCache.get(filePath) as T | null
    try {
        const result = yaml.parse(fs.readFileSync(filePath, 'utf8')) as T
        yamlCache.set(filePath, result)
        return result
    } catch {
        yamlCache.set(filePath, null)
        return null
    }
}

interface MarkdownContent<T = Record<string, unknown>> {
    frontmatter: T
    body: string
}

function readMarkdownFile<T = Record<string, unknown>>(filePath: string): MarkdownContent<T> | null {
    if (mdCache.has(filePath)) return mdCache.get(filePath) as MarkdownContent<T> | null
    try {
        const raw = fs.readFileSync(filePath, 'utf8')
        const { data, content } = matter(raw)
        const result: MarkdownContent<T> = { frontmatter: data as T, body: content.trim() }
        mdCache.set(filePath, result)
        return result
    } catch {
        mdCache.set(filePath, null)
        return null
    }
}

// --- Entity directory readers ---

/** Read data.yaml from an entity directory */
export function readEntitySeo<T>(entityType: string, slug: string): T | null {
    return readYamlFile<T>(path.join(CONTENT_ROOT, entityType, slug, 'data.yaml'))
}

/** Read a locale .md file from an entity directory */
export function readEntityContent<T = Record<string, unknown>>(
    entityType: string,
    slug: string,
    locale: string
): MarkdownContent<T> | null {
    return readMarkdownFile<T>(path.join(CONTENT_ROOT, entityType, slug, `${locale}.md`))
}

/** Read the _index.yaml manifest for an entity type */
export function readEntityIndex<T>(entityType: string): T | null {
    return readYamlFile<T>(path.join(CONTENT_ROOT, entityType, '_index.yaml'))
}

/** List all entity slugs by reading _index.yaml (published only) */
export function listEntitySlugs(entityType: string, key: string): string[] {
    const index = readEntityIndex<Record<string, Array<{ slug: string; status?: string }>>>(entityType)
    if (!index?.[key]) return []
    return index[key].filter((item) => (item.status ?? 'published') === 'published').map((item) => item.slug)
}

/** Check if an entity is published (missing status = published) */
export function isPublished(entry: { status?: string }): boolean {
    return (entry.status ?? 'published') === 'published'
}

/** Check if a locale file exists for an entity */
export function entityLocaleExists(entityType: string, slug: string, locale: string): boolean {
    return fs.existsSync(path.join(CONTENT_ROOT, entityType, slug, `${locale}.md`))
}
