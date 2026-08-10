import fs from 'fs'
import path from 'path'
import { isDeepStrictEqual } from 'util'
import matter from 'gray-matter'
import { remarkNoExecutableContent } from '../../src/lib/mdx-security'
import { findSplitGuideHeadingCollisions, remarkRejectSplitGuideH1 } from './split-guide-contract'

const LOCALES = ['en', 'es-419', 'pt-br'] as const
type SplitGuideLocale = (typeof LOCALES)[number]

const LOCALE_SET = new Set<string>(LOCALES)
const CTA_TEXT: Record<SplitGuideLocale, string> = {
    en: 'Start a split',
    'es-419': 'Crear un split',
    'pt-br': 'Criar um split',
}
const COMPONENT_PROPS: Record<string, { allowed: Set<string>; required: Set<string> }> = {
    Steps: { allowed: new Set(['title']), required: new Set() },
    Step: { allowed: new Set(['title']), required: new Set(['title']) },
    Callout: { allowed: new Set(['type']), required: new Set(['type']) },
    CTA: {
        allowed: new Set(['text', 'href', 'subtitle', 'variant']),
        required: new Set(['text', 'href', 'subtitle', 'variant']),
    },
    RelatedPages: { allowed: new Set(['title']), required: new Set() },
    RelatedLink: { allowed: new Set(['href']), required: new Set(['href']) },
}
const OUTPUT_FIELDS = new Set([
    'title',
    'description',
    'slug',
    'type',
    'lang',
    'author',
    'date',
    'tags',
    'claims',
    'cast',
    'schema_types',
    'canonical',
    'alternates',
    'generated_from',
    'generated_at',
    'published',
])
const SOURCE_METADATA_FIELDS = [
    'title',
    'description',
    'slug',
    'type',
    'lang',
    'author',
    'date',
    'tags',
    'claims',
    'cast',
    'schema_types',
    'canonical',
    'alternates',
    'generated_from',
    'generated_at',
] as const

type ReportError = (check: string, message: string, file?: string) => void

export interface VerifySplitGuidesOptions {
    contentDir: string
    manifestPath: string
    reportError: ReportError
    /** Test seam; production uses the same compiler as the runtime MDX stack. */
    validateMdx?: (body: string) => Promise<void>
}

export interface VerifySplitGuidesResult {
    recordsChecked: number
}

interface SplitGuideRecord {
    file: string
    slug: string
    locale: SplitGuideLocale
    content: string
    body: string
    frontmatter: Record<string, unknown>
}

interface ParsedJsxTag {
    name: string
    rawAttributes: string
    start: number
    end: number
    selfClosing: boolean
}

interface ManifestLocaleEntry extends Record<string, unknown> {
    title: string
    description: string
    slug: string
    type: string
    lang: string
    author: string
    date: string
    tags: string[]
    claims: string[]
    cast: string[]
    schema_types: string[]
    canonical: string
    alternates: Record<string, string>
    source: { path: string; content_mode: string; source_provenance: string }
    generated_from: Record<string, unknown>
    generated_at: string
}

interface SplitGuideManifest {
    version: number
    intent: string
    locales: string[]
    allowed_product_claim_ids: string[]
    guides: Record<string, Record<string, ManifestLocaleEntry>>
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function listDirs(dir: string): string[] {
    if (!fs.existsSync(dir)) return []
    return fs
        .readdirSync(dir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort()
}

function rawFrontmatterScalar(content: string, key: string): string | null {
    const block = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)
    if (!block) return null
    const line = block[1].match(new RegExp(`^${key}:\\s*(.*)$`, 'm'))
    if (!line) return null
    const value = line[1].trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        return value.slice(1, -1)
    }
    return value
}

function isValidIsoDate(value: unknown): value is string {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
    const parsed = new Date(`${value}T00:00:00.000Z`)
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().split('T')[0] === value
}

function isStringArray(value: unknown, allowEmpty: boolean): value is string[] {
    return (
        Array.isArray(value) &&
        (allowEmpty || value.length > 0) &&
        value.every((item) => typeof item === 'string' && item.trim().length > 0)
    )
}

function stringLength(value: string): number {
    return Array.from(value).length
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function expectedAlternates(slug: string): Record<SplitGuideLocale, string> {
    return {
        en: `content/split-guides/${slug}/en.md`,
        'es-419': `content/split-guides/${slug}/es-419.md`,
        'pt-br': `content/split-guides/${slug}/pt-br.md`,
    }
}

function expectedGeneratedFrom(slug: string, locale: SplitGuideLocale): Record<string, unknown> {
    const data = [`content/_system/data/split-guides/${slug}.md`]
    const context = ['projects/peanut-split/seo/stylebook.md']
    if (locale !== 'en') {
        data.push(`content/_system/data/split-guides/${slug}.${locale}.md`)
        context.push(`projects/peanut-split/seo/localization.${locale}.md`)
    }
    context.push('content/_system/context/valid-links.md')

    return {
        template: 'content/_system/templates/split-guide.md',
        data,
        product: ['product/peanut-split.md'],
        workflow: 'content/_system/workflows/generate-content.md',
        context,
        guidelines: [
            'content/_system/guidelines/seo.md',
            'content/_system/guidelines/components.md',
            'content/_system/guidelines/locales.md',
        ],
    }
}

function parseManifest(manifestPath: string, reportError: ReportError): SplitGuideManifest | null {
    let raw: unknown
    try {
        raw = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
    } catch (cause) {
        const message = cause instanceof Error ? cause.message : String(cause)
        reportError('split-guide-manifest', `Manifest is not valid JSON: ${message}`, manifestPath)
        return null
    }

    if (!isRecord(raw)) {
        reportError('split-guide-manifest', 'Manifest root must be an object', manifestPath)
        return null
    }
    if (raw.version !== 1) reportError('split-guide-manifest', 'Manifest version must be 1', manifestPath)
    if (raw.intent !== 'split-guides') {
        reportError('split-guide-manifest', 'Manifest intent must be split-guides', manifestPath)
    }
    if (!isDeepStrictEqual(raw.locales, [...LOCALES])) {
        reportError(
            'split-guide-manifest',
            'Manifest locales must be exactly [en, es-419, pt-br] in that order',
            manifestPath
        )
    }
    if (!isStringArray(raw.allowed_product_claim_ids, false)) {
        reportError(
            'split-guide-manifest',
            'Manifest allowed_product_claim_ids must be a nonempty string array',
            manifestPath
        )
    } else {
        if (new Set(raw.allowed_product_claim_ids).size !== raw.allowed_product_claim_ids.length) {
            reportError('split-guide-manifest', 'Manifest product claim IDs must be unique', manifestPath)
        }
        for (const claim of raw.allowed_product_claim_ids) {
            if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(claim)) {
                reportError('split-guide-manifest', `Invalid product claim ID: ${claim}`, manifestPath)
            }
        }
    }
    if (!isRecord(raw.guides)) {
        reportError('split-guide-manifest', 'Manifest guides must be an object', manifestPath)
        return null
    }
    if (Object.keys(raw.guides).length === 0) {
        reportError('split-guide-manifest', 'Manifest guides must contain at least one guide', manifestPath)
    }

    return raw as unknown as SplitGuideManifest
}

function validateManifestEntry(
    slug: string,
    locale: SplitGuideLocale,
    entry: unknown,
    allowedClaims: Set<string>,
    manifestPath: string,
    reportError: ReportError
): entry is ManifestLocaleEntry {
    const label = `${manifestPath}#guides.${slug}.${locale}`
    if (!isRecord(entry)) {
        reportError('split-guide-manifest', 'Guide locale entry must be an object', label)
        return false
    }

    const stringFields = ['title', 'description', 'slug', 'type', 'lang', 'author', 'canonical', 'generated_at']
    for (const field of stringFields) {
        if (typeof entry[field] !== 'string' || !entry[field].trim()) {
            reportError('split-guide-manifest', `${field} must be a nonempty string`, label)
        }
    }
    if (!isValidIsoDate(entry.date)) reportError('split-guide-manifest', 'date must be a real YYYY-MM-DD', label)
    if (!isValidIsoDate(entry.generated_at)) {
        reportError('split-guide-manifest', 'generated_at must be a real YYYY-MM-DD', label)
    }
    if (entry.slug !== slug) reportError('split-guide-manifest', `slug must equal ${slug}`, label)
    if (entry.lang !== locale) reportError('split-guide-manifest', `lang must equal ${locale}`, label)
    if (entry.type !== 'guide') reportError('split-guide-manifest', 'type must be guide', label)
    if (entry.author !== 'Peanut') reportError('split-guide-manifest', 'author must be Peanut', label)
    if (entry.canonical !== `peanut.me/${locale}/split/guides/${slug}`) {
        reportError('split-guide-manifest', 'canonical does not match the exact guide URL', label)
    }
    if (!isStringArray(entry.tags, false)) {
        reportError('split-guide-manifest', 'tags must be a nonempty string array', label)
    }
    if (!isStringArray(entry.claims, false)) {
        reportError('split-guide-manifest', 'claims must be a nonempty string array', label)
    } else {
        for (const claim of entry.claims) {
            if (!allowedClaims.has(claim)) {
                reportError(
                    'split-guide-claims',
                    `Claim ${claim} does not resolve to a product truth block in the manifest`,
                    label
                )
            }
        }
    }
    if (!isStringArray(entry.cast, true)) reportError('split-guide-manifest', 'cast must be a string array', label)
    if (!isDeepStrictEqual(entry.schema_types, ['Article', 'BlogPosting'])) {
        reportError('split-guide-manifest', 'schema_types must be exactly [Article, BlogPosting]', label)
    }
    if (!isDeepStrictEqual(entry.alternates, expectedAlternates(slug))) {
        reportError('split-guide-manifest', 'alternates do not match the exact three locale files', label)
    }
    if (!isDeepStrictEqual(entry.generated_from, expectedGeneratedFrom(slug, locale))) {
        reportError('split-guide-provenance', 'generated_from does not match the exact core source paths', label)
    }

    if (!isRecord(entry.source)) {
        reportError('split-guide-provenance', 'source must be an object', label)
    } else {
        const expectedSourcePath = `content/_system/data/split-guides/${slug}${locale === 'en' ? '' : `.${locale}`}.md`
        if (entry.source.path !== expectedSourcePath) {
            reportError('split-guide-provenance', `source.path must be ${expectedSourcePath}`, label)
        }
        if (entry.source.content_mode !== 'compose') {
            reportError('split-guide-provenance', 'source.content_mode must be compose', label)
        }
        if (typeof entry.source.source_provenance !== 'string' || !entry.source.source_provenance.trim()) {
            reportError('split-guide-provenance', 'source.source_provenance must be nonempty', label)
        } else {
            const expectedProvenance = new RegExp(
                `^peanutprotocol/peanutsplit@[0-9a-f]{40}:apps/web/src/content/blog/${escapeRegExp(slug)}/${escapeRegExp(locale)}\\.md$`
            )
            if (!expectedProvenance.test(entry.source.source_provenance)) {
                reportError(
                    'split-guide-provenance',
                    `source.source_provenance must match peanutprotocol/peanutsplit@{40hex}:apps/web/src/content/blog/${slug}/${locale}.md`,
                    label
                )
            }
        }
    }

    return true
}

function extractJsxTags(body: string): ParsedJsxTag[] {
    const tags: ParsedJsxTag[] = []
    const tagPattern = /<([A-Za-z][A-Za-z0-9.]*)\b((?:"[^"]*"|'[^']*'|[^"'<>])*)>/g
    let match: RegExpExecArray | null
    while ((match = tagPattern.exec(body)) !== null) {
        // GFM autolinks are ordinary Markdown, not authored JSX tags.
        if (/^<(?:https?:\/\/|mailto:)[^<>\s]+>$/.test(match[0]) || /^<[^<>\s@]+@[^<>\s@]+>$/.test(match[0])) {
            continue
        }
        tags.push({
            name: match[1],
            rawAttributes: match[2],
            start: match.index,
            end: tagPattern.lastIndex,
            selfClosing: match[2].trimEnd().endsWith('/'),
        })
    }
    return tags
}

function parseLiteralJsxAttributes(
    rawAttributes: string
): { attrs: Record<string, string>; error?: never } | { attrs?: never; error: string } {
    let source = rawAttributes.trim()
    if (source.endsWith('/')) source = source.slice(0, -1).trimEnd()

    const attrs: Record<string, string> = {}
    let offset = 0
    while (offset < source.length) {
        offset += source.slice(offset).match(/^\s*/)?.[0].length ?? 0
        if (offset >= source.length) break

        const match = source.slice(offset).match(/^([A-Za-z][A-Za-z0-9_-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/)
        if (!match) {
            return { error: `attributes must be literal quoted strings near: ${source.slice(offset, offset + 40)}` }
        }
        const name = match[1]
        if (Object.prototype.hasOwnProperty.call(attrs, name)) return { error: `duplicate attribute: ${name}` }
        attrs[name] = match[2] ?? match[3] ?? ''
        offset += match[0].length
    }
    return { attrs }
}

function validateComponentProps(
    record: SplitGuideRecord,
    tag: ParsedJsxTag,
    reportError: ReportError
): Record<string, string> | null {
    const contract = COMPONENT_PROPS[tag.name]
    if (!contract) {
        reportError('split-guide-mdx', `Unsupported MDX component <${tag.name}>`, record.file)
        return null
    }

    const parsed = parseLiteralJsxAttributes(tag.rawAttributes)
    if ('error' in parsed) {
        reportError('split-guide-mdx', `<${tag.name}> ${parsed.error}`, record.file)
        return null
    }
    for (const name of Object.keys(parsed.attrs)) {
        if (!contract.allowed.has(name)) {
            reportError('split-guide-mdx', `<${tag.name}> does not support the ${name} prop`, record.file)
        }
    }
    for (const name of contract.required) {
        if (!parsed.attrs[name]?.trim()) {
            reportError('split-guide-mdx', `<${tag.name}> requires a nonempty ${name} prop`, record.file)
        }
    }
    if (tag.name === 'Callout' && parsed.attrs.type !== 'info') {
        reportError('split-guide-mdx', '<Callout> type must be exactly info', record.file)
    }

    const mustHaveChildren = ['Steps', 'Step', 'Callout', 'RelatedPages', 'RelatedLink'].includes(tag.name)
    if (mustHaveChildren && tag.selfClosing) {
        reportError('split-guide-mdx', `<${tag.name}> must contain child content`, record.file)
    }
    if (tag.name === 'CTA' && !tag.selfClosing) {
        reportError('split-guide-mdx', '<CTA> must be self-closing', record.file)
    }
    return parsed.attrs
}

function comparableOutputValue(record: SplitGuideRecord, field: (typeof SOURCE_METADATA_FIELDS)[number]): unknown {
    if (field === 'date' || field === 'generated_at') return rawFrontmatterScalar(record.content, field)
    return record.frontmatter[field]
}

function validateFrontmatter(
    record: SplitGuideRecord,
    expected: ManifestLocaleEntry | undefined,
    allowedClaims: Set<string>,
    reportError: ReportError
) {
    const { slug, locale, content, frontmatter: fm, file } = record

    for (const key of Object.keys(fm)) {
        if (!OUTPUT_FIELDS.has(key)) {
            reportError('split-guide-contract', `Unexpected frontmatter field: ${key}`, file)
        }
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
        reportError('split-guide-contract', `Directory slug is not canonical kebab-case: ${slug}`, file)
    }
    if (fm.type !== 'guide') reportError('split-guide-contract', 'type must be guide', file)
    if (fm.lang !== locale) reportError('split-guide-contract', `lang must exactly match filename: ${locale}`, file)
    if (fm.slug !== slug) reportError('split-guide-contract', `slug must exactly match directory: ${slug}`, file)
    if (fm.canonical !== `peanut.me/${locale}/split/guides/${slug}`) {
        reportError('split-guide-contract', `canonical must be peanut.me/${locale}/split/guides/${slug}`, file)
    }
    if (fm.author !== 'Peanut') reportError('split-guide-contract', 'author must be Peanut', file)
    if (fm.published !== undefined && typeof fm.published !== 'boolean') {
        reportError('split-guide-contract', 'published must be a boolean when present', file)
    } else if (fm.published === false) {
        reportError('split-guide-contract', `Exact canary locale ${locale} must be published`, file)
    }

    if (typeof fm.title !== 'string' || !fm.title.trim()) {
        reportError('split-guide-contract', 'title must be a nonempty string', file)
    } else {
        const rawLength = stringLength(fm.title)
        const effectiveLength = stringLength(`${fm.title} | Peanut`)
        if (/\|\s*Peanut\s*$/i.test(fm.title)) {
            reportError('split-guide-contract', 'title must be raw; the route owns the | Peanut suffix', file)
        }
        if (rawLength > 60 || effectiveLength > 60) {
            reportError(
                'split-guide-contract',
                `title is too long (raw ${rawLength}, effective ${effectiveLength}; both must be <= 60)`,
                file
            )
        }
    }
    if (typeof fm.description !== 'string') {
        reportError('split-guide-contract', 'description must be a string', file)
    } else {
        const length = stringLength(fm.description)
        if (length < 140 || length > 160) {
            reportError('split-guide-contract', `description must be 140-160 characters (found ${length})`, file)
        }
        if (!fm.description.endsWith('.')) {
            reportError('split-guide-contract', 'description must end with a period', file)
        }
    }
    if (!isValidIsoDate(rawFrontmatterScalar(content, 'date'))) {
        reportError('split-guide-contract', 'date must be a real YYYY-MM-DD calendar date', file)
    }
    if (!isStringArray(fm.claims, false)) {
        reportError('split-guide-contract', 'claims must be a nonempty array of nonempty strings', file)
    } else {
        if (new Set(fm.claims).size !== fm.claims.length) {
            reportError('split-guide-claims', 'claims must not contain duplicates', file)
        }
        for (const claim of fm.claims) {
            if (!allowedClaims.has(claim)) {
                reportError('split-guide-claims', `Unknown Peanut Split product claim: ${claim}`, file)
            }
        }
    }
    if (!isStringArray(fm.cast, true)) {
        reportError('split-guide-contract', 'cast must be an array of strings (empty is allowed)', file)
    }
    if (!isStringArray(fm.tags, false)) {
        reportError('split-guide-contract', 'tags must be a nonempty array of nonempty strings', file)
    }
    if (!isDeepStrictEqual(fm.schema_types, ['Article', 'BlogPosting'])) {
        reportError('split-guide-contract', 'schema_types must be exactly [Article, BlogPosting]', file)
    }
    if (!isDeepStrictEqual(fm.alternates, expectedAlternates(slug))) {
        reportError('split-guide-contract', 'alternates must list exactly the three exact-locale guide files', file)
    }
    if (!isDeepStrictEqual(fm.generated_from, expectedGeneratedFrom(slug, locale))) {
        reportError('split-guide-provenance', 'generated_from must contain exactly the required source paths', file)
    }
    if (!isValidIsoDate(rawFrontmatterScalar(content, 'generated_at'))) {
        reportError('split-guide-provenance', 'generated_at must be a real YYYY-MM-DD', file)
    }

    if (!expected) {
        reportError('split-guide-manifest', 'No exact slug/locale entry exists in the contract manifest', file)
        return
    }
    for (const field of SOURCE_METADATA_FIELDS) {
        const actualValue = comparableOutputValue(record, field)
        const expectedValue = expected[field]
        if (!isDeepStrictEqual(actualValue, expectedValue)) {
            reportError(
                'split-guide-manifest',
                `${field} differs from the selected compose source (expected ${JSON.stringify(expectedValue)}, found ${JSON.stringify(actualValue)})`,
                file
            )
        }
    }
}

async function validateBody(
    record: SplitGuideRecord,
    recordsByKey: Map<string, SplitGuideRecord>,
    reportError: ReportError,
    validateMdx: (body: string) => Promise<void>
) {
    const { body, file, locale, slug } = record
    const headingCollisionMessages = {
        'atx-h1': 'Body must not contain an ATX H1 (including indented forms)',
        'setext-h1': 'Body must not contain a CommonMark setext H1',
        'html-h1': 'Body must not contain a literal <h1>',
        hero: 'Body must not contain <Hero>',
    }
    for (const collision of findSplitGuideHeadingCollisions(body)) {
        reportError('split-guide-mdx', headingCollisionMessages[collision], file)
    }
    if (/<FAQ(?:Item)?\b/.test(body)) reportError('split-guide-mdx', 'Split guides must not contain FAQ', file)
    if (/peanutsplit\.com/i.test(body)) {
        reportError('split-guide-contract', 'Legacy peanutsplit.com links are forbidden', file)
    }

    try {
        await validateMdx(body)
    } catch (cause) {
        const message = cause instanceof Error ? cause.message.split('\n')[0] : String(cause)
        reportError('split-guide-mdx', `Malformed or unsafe MDX: ${message}`, file)
    }

    const tags = extractJsxTags(body)
    const attrsByTag = new Map<ParsedJsxTag, Record<string, string>>()
    for (const tag of tags) {
        const attrs = validateComponentProps(record, tag, reportError)
        if (attrs) attrsByTag.set(tag, attrs)
    }

    const ctas = tags.filter((tag) => tag.name === 'CTA')
    const relatedPages = tags.filter((tag) => tag.name === 'RelatedPages')
    const relatedLinks = tags.filter((tag) => tag.name === 'RelatedLink')
    if (ctas.length !== 1) reportError('split-guide-contract', `Expected exactly one CTA; found ${ctas.length}`, file)
    if (relatedPages.length !== 1) {
        reportError('split-guide-contract', `Expected exactly one RelatedPages; found ${relatedPages.length}`, file)
    }
    if (relatedLinks.length !== 1) {
        reportError('split-guide-contract', `Expected exactly one RelatedLink; found ${relatedLinks.length}`, file)
    }

    const cta = ctas[0]
    const ctaAttrs = cta ? attrsByTag.get(cta) : undefined
    if (ctaAttrs) {
        if (ctaAttrs.text !== CTA_TEXT[locale]) {
            reportError('split-guide-contract', `CTA text must be "${CTA_TEXT[locale]}"`, file)
        }
        if (ctaAttrs.variant !== 'card') reportError('split-guide-contract', 'CTA variant must be card', file)

        let ctaUrl: URL | null = null
        try {
            ctaUrl = new URL(ctaAttrs.href)
        } catch {
            reportError('split-guide-contract', 'CTA href must be an absolute HTTPS URL', file)
        }
        if (ctaUrl) {
            if (
                ctaUrl.origin !== 'https://split.peanut.me' ||
                ctaUrl.pathname !== '/new' ||
                ctaUrl.hash ||
                ctaUrl.username ||
                ctaUrl.password
            ) {
                reportError('split-guide-contract', 'CTA href must target exactly https://split.peanut.me/new', file)
            }
            const expectedQuery: Record<string, string> = {
                locale,
                utm_medium: 'content',
                utm_source: 'split-guide',
                utm_campaign: slug,
                utm_content: 'final-cta',
            }
            const keys = [...ctaUrl.searchParams.keys()]
            const expectedKeys = Object.keys(expectedQuery)
            if (
                keys.length !== expectedKeys.length ||
                new Set(keys).size !== expectedKeys.length ||
                expectedKeys.some((key) => !keys.includes(key))
            ) {
                reportError('split-guide-contract', `CTA query must contain exactly: ${expectedKeys.join(', ')}`, file)
            }
            for (const [key, expectedValue] of Object.entries(expectedQuery)) {
                if (ctaUrl.searchParams.get(key) !== expectedValue) {
                    reportError('split-guide-contract', `CTA ${key} must equal ${expectedValue}`, file)
                }
            }
        }
    }

    const related = relatedPages[0]
    const relatedCloseMatches = [...body.matchAll(/<\/RelatedPages\s*>/g)]
    if (relatedCloseMatches.length !== 1) {
        reportError(
            'split-guide-contract',
            `Expected exactly one closing </RelatedPages>; found ${relatedCloseMatches.length}`,
            file
        )
    }
    const relatedClose = relatedCloseMatches[0]
    if (cta && related) {
        if (related.start <= cta.end) {
            reportError('split-guide-contract', 'RelatedPages must appear after the final CTA', file)
        } else if (body.slice(cta.end, related.start).trim()) {
            reportError(
                'split-guide-contract',
                'Only whitespace may appear between the final CTA and RelatedPages',
                file
            )
        }
    }
    if (relatedClose && body.slice((relatedClose.index ?? 0) + relatedClose[0].length).trim()) {
        reportError('split-guide-contract', 'RelatedPages must be the final content block', file)
    }

    const relatedLink = relatedLinks[0]
    const relatedAttrs = relatedLink ? attrsByTag.get(relatedLink) : undefined
    const relatedLinkCloseMatches = [...body.matchAll(/<\/RelatedLink\s*>/g)]
    if (relatedLinkCloseMatches.length !== 1) {
        reportError(
            'split-guide-contract',
            `Expected exactly one closing </RelatedLink>; found ${relatedLinkCloseMatches.length}`,
            file
        )
    }
    const relatedLinkClose = relatedLinkCloseMatches[0]
    if (related && relatedClose && relatedLink && relatedLinkClose) {
        const relatedCloseIndex = relatedClose.index ?? -1
        const linkCloseIndex = relatedLinkClose.index ?? -1
        if (
            relatedLink.start <= related.end ||
            relatedLink.end >= relatedCloseIndex ||
            linkCloseIndex >= relatedCloseIndex
        ) {
            reportError('split-guide-contract', 'RelatedLink must be nested inside RelatedPages', file)
        }
        if (!body.slice(relatedLink.end, linkCloseIndex).trim()) {
            reportError('split-guide-contract', 'RelatedLink must have nonempty link text', file)
        }
    }
    if (relatedAttrs) {
        const escapedLocale = escapeRegExp(locale)
        const hrefMatch = relatedAttrs.href.match(new RegExp(`^/${escapedLocale}/split/guides/([a-z0-9-]+)$`))
        if (!hrefMatch) {
            reportError(
                'split-guide-contract',
                `RelatedLink must target /${locale}/split/guides/{slug} in the same locale`,
                file
            )
        } else {
            const targetSlug = hrefMatch[1]
            if (targetSlug === slug) reportError('split-guide-contract', 'RelatedLink must not point to itself', file)
            const target = recordsByKey.get(`${locale}/${targetSlug}`)
            if (!target || target.frontmatter.published === false) {
                reportError('split-guide-contract', 'RelatedLink target must be an exact-locale published guide', file)
            }
        }
    }
}

async function compileSplitGuideMdx(body: string): Promise<void> {
    // These packages are ESM-only. A dynamic import keeps verify-content
    // runnable under the repository's tsx/CommonJS script entrypoint.
    const [{ serialize }, { default: remarkGfm }] = await Promise.all([
        import('next-mdx-remote/serialize'),
        import('remark-gfm'),
    ])
    await serialize(body, {
        mdxOptions: {
            format: 'mdx',
            remarkPlugins: [remarkNoExecutableContent, remarkRejectSplitGuideH1, remarkGfm],
        },
    })
}

export async function verifySplitGuides({
    contentDir,
    manifestPath,
    reportError,
    validateMdx = compileSplitGuideMdx,
}: VerifySplitGuidesOptions): Promise<VerifySplitGuidesResult> {
    const splitRoot = path.join(contentDir, 'split-guides')
    const slugs = listDirs(splitRoot)
    const hasGuideFiles = slugs.some((slug) =>
        fs
            .readdirSync(path.join(splitRoot, slug), { withFileTypes: true })
            .some((entry) => entry.isFile() && /\.mdx?$/.test(entry.name))
    )
    if (!hasGuideFiles && !fs.existsSync(manifestPath)) return { recordsChecked: 0 }
    if (!fs.existsSync(manifestPath)) {
        reportError(
            'split-guide-manifest',
            'Split guide files require generated/split-guide-manifest.json',
            manifestPath
        )
        return { recordsChecked: 0 }
    }

    const manifest = parseManifest(manifestPath, reportError)
    if (!manifest) return { recordsChecked: 0 }
    const allowedClaims = new Set(
        isStringArray(manifest.allowed_product_claim_ids, false) ? manifest.allowed_product_claim_ids : []
    )
    const manifestGuides = isRecord(manifest.guides) ? manifest.guides : {}

    const manifestSlugs = Object.keys(manifestGuides).sort()
    for (const slug of manifestSlugs) {
        if (!slugs.includes(slug)) {
            reportError('split-guide-locales', `Manifest guide has no output directory: ${slug}`, manifestPath)
        }
    }
    for (const slug of slugs) {
        if (!manifestSlugs.includes(slug)) {
            reportError(
                'split-guide-manifest',
                `Output slug is absent from manifest: ${slug}`,
                path.join(splitRoot, slug)
            )
        }
    }

    const records: SplitGuideRecord[] = []
    const recordsByKey = new Map<string, SplitGuideRecord>()
    for (const slug of slugs) {
        const slugDir = path.join(splitRoot, slug)
        const contentFiles = fs
            .readdirSync(slugDir, { withFileTypes: true })
            .filter((entry) => entry.isFile() && /\.mdx?$/.test(entry.name))
            .map((entry) => entry.name)
            .sort()

        for (const locale of LOCALES) {
            if (!contentFiles.includes(`${locale}.md`)) {
                reportError('split-guide-locales', `Missing required exact locale file: ${locale}.md`, slugDir)
            }
        }
        for (const filename of contentFiles) {
            const locale = filename.replace(/\.mdx?$/, '')
            if (!LOCALE_SET.has(locale) || filename !== `${locale}.md`) {
                reportError(
                    'split-guide-locales',
                    `Unexpected locale/file ${filename}; only en.md, es-419.md and pt-br.md are allowed`,
                    path.join(slugDir, filename)
                )
            }
        }

        const manifestLocales = isRecord(manifestGuides[slug]) ? Object.keys(manifestGuides[slug]).sort() : []
        if (!isDeepStrictEqual(manifestLocales, [...LOCALES].sort())) {
            reportError(
                'split-guide-manifest',
                'Guide manifest locales must be exactly en, es-419 and pt-br',
                `${manifestPath}#guides.${slug}`
            )
        }

        for (const locale of LOCALES) {
            const manifestEntry = isRecord(manifestGuides[slug]) ? manifestGuides[slug][locale] : undefined
            validateManifestEntry(slug, locale, manifestEntry, allowedClaims, manifestPath, reportError)

            const file = path.join(slugDir, `${locale}.md`)
            if (!fs.existsSync(file)) continue
            const content = fs.readFileSync(file, 'utf8')
            let body = ''
            let frontmatter: Record<string, unknown> = {}
            try {
                const parsed = matter(content)
                body = parsed.content.trim()
                if (isRecord(parsed.data)) frontmatter = parsed.data
            } catch (cause) {
                const message = cause instanceof Error ? cause.message : String(cause)
                reportError('split-guide-contract', `Malformed frontmatter: ${message}`, file)
            }
            const record = { file, slug, locale, content, body, frontmatter }
            records.push(record)
            recordsByKey.set(`${locale}/${slug}`, record)
        }
    }

    for (const record of records) {
        const expected = isRecord(manifestGuides[record.slug])
            ? (manifestGuides[record.slug][record.locale] as ManifestLocaleEntry | undefined)
            : undefined
        validateFrontmatter(record, expected, allowedClaims, reportError)
    }
    for (const record of records) await validateBody(record, recordsByKey, reportError, validateMdx)

    return { recordsChecked: records.length }
}
