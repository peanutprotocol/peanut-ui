#!/usr/bin/env tsx
/**
 * Content validation for peanut-ui.
 * Run: npx tsx scripts/validate-content.ts
 *
 * Validates that content consumed by SEO loaders (src/data/seo/*.ts) has:
 * 1. Valid YAML frontmatter with required fields per content type
 * 2. Slugs matching expected URL patterns
 * 3. Published flag set correctly
 * 4. en.md files present for all published content
 * 5. Entity data files present for all content pages
 */

import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'

const ROOT = path.join(process.cwd(), 'src/content')
const errors: string[] = []
const warnings: string[] = []

function error(msg: string) {
    errors.push(`ERROR: ${msg}`)
}

function warn(msg: string) {
    warnings.push(`WARN: ${msg}`)
}

function rel(filePath: string): string {
    return path.relative(ROOT, filePath)
}

function readFrontmatter(filePath: string): Record<string, unknown> | null {
    try {
        const raw = fs.readFileSync(filePath, 'utf8')
        const { data } = matter(raw)
        return data
    } catch (e) {
        error(`Invalid frontmatter: ${rel(filePath)} — ${(e as Error).message}`)
        return null
    }
}

function listDirs(dir: string): string[] {
    try {
        return fs
            .readdirSync(dir, { withFileTypes: true })
            .filter((d) => d.isDirectory())
            .map((d) => d.name)
    } catch {
        return []
    }
}

function listMdFiles(dir: string): string[] {
    try {
        return fs
            .readdirSync(dir)
            .filter((f) => f.endsWith('.md') && f !== 'README.md')
    } catch {
        return []
    }
}

// --- Content type validators ---

interface ContentTypeConfig {
    /** Directory under content/ */
    contentDir: string
    /** Directory under input/data/ for entity data (null if no entity data expected) */
    entityDir: string | null
    /** Required frontmatter fields */
    requiredFields: string[]
    /** Slug pattern regex (validates the directory name) */
    slugPattern?: RegExp
    /** Optional: additional entity data required fields */
    entityRequiredFields?: string[]
}

const CONTENT_TYPES: ContentTypeConfig[] = [
    {
        contentDir: 'countries',
        entityDir: 'countries',
        requiredFields: ['title', 'description', 'slug', 'lang', 'published'],
        slugPattern: /^[a-z]+(-[a-z]+)*$/,
        entityRequiredFields: ['name', 'currency'],
    },
    {
        contentDir: 'compare',
        entityDir: 'competitors',
        requiredFields: ['title', 'description', 'slug', 'lang', 'published', 'competitor'],
        slugPattern: /^[a-z0-9]+(-[a-z0-9]+)*$/,
        entityRequiredFields: ['name', 'type'],
    },
    {
        contentDir: 'deposit',
        entityDir: null, // deposit content doesn't map 1:1 to exchange entities
        requiredFields: ['title', 'description', 'slug', 'lang', 'published'],
        slugPattern: /^[a-z0-9]+(-[a-z0-9]+)*$/,
    },
    {
        contentDir: 'pay-with',
        entityDir: 'spending-methods',
        requiredFields: ['title', 'description', 'slug', 'lang', 'published'],
        slugPattern: /^[a-z]+(-[a-z]+)*$/,
        entityRequiredFields: ['name', 'type'],
    },
]

interface TypeCounts {
    total: number
    published: number
    draft: number
    missingEn: number
}

function validateContentType(config: ContentTypeConfig): TypeCounts {
    const contentPath = path.join(ROOT, 'content', config.contentDir)
    const slugs = listDirs(contentPath)
    const counts: TypeCounts = { total: slugs.length, published: 0, draft: 0, missingEn: 0 }

    for (const slug of slugs) {
        const slugDir = path.join(contentPath, slug)

        // Validate slug format
        if (config.slugPattern && !config.slugPattern.test(slug)) {
            error(`${config.contentDir}/${slug}: slug doesn't match pattern ${config.slugPattern}`)
        }

        // Check en.md exists
        const enPath = path.join(slugDir, 'en.md')
        if (!fs.existsSync(enPath)) {
            error(`${config.contentDir}/${slug}: missing en.md`)
            counts.missingEn++
            continue
        }

        // Validate frontmatter
        const fm = readFrontmatter(enPath)
        if (!fm) continue

        // Check required fields
        for (const field of config.requiredFields) {
            if (fm[field] === undefined || fm[field] === null || fm[field] === '') {
                error(`${config.contentDir}/${slug}/en.md: missing required field '${field}'`)
            }
        }

        // Check slug consistency
        if (fm.slug && fm.slug !== slug) {
            warn(`${config.contentDir}/${slug}/en.md: frontmatter slug '${fm.slug}' doesn't match directory name '${slug}'`)
        }

        // Check published status
        if (fm.published === true) {
            counts.published++
        } else {
            counts.draft++
        }

        // Validate locale files have matching slugs
        const mdFiles = listMdFiles(slugDir)
        for (const mdFile of mdFiles) {
            if (mdFile === 'en.md') continue
            const localeFm = readFrontmatter(path.join(slugDir, mdFile))
            if (localeFm && localeFm.slug && localeFm.slug !== slug) {
                warn(`${config.contentDir}/${slug}/${mdFile}: frontmatter slug '${localeFm.slug}' doesn't match directory '${slug}'`)
            }
            if (localeFm && localeFm.lang) {
                const expectedLang = mdFile.replace('.md', '')
                if (localeFm.lang !== expectedLang) {
                    warn(`${config.contentDir}/${slug}/${mdFile}: frontmatter lang '${localeFm.lang}' doesn't match filename '${expectedLang}'`)
                }
            }
        }

        // Cross-reference entity data
        if (config.entityDir) {
            const entityPath = path.join(ROOT, 'input/data', config.entityDir, `${slug}.md`)
            if (!fs.existsSync(entityPath)) {
                warn(`${config.contentDir}/${slug}: no matching entity data at input/data/${config.entityDir}/${slug}.md`)
            } else if (config.entityRequiredFields) {
                const entityFm = readFrontmatter(entityPath)
                if (entityFm) {
                    for (const field of config.entityRequiredFields) {
                        if (entityFm[field] === undefined || entityFm[field] === null) {
                            error(`input/data/${config.entityDir}/${slug}.md: missing required field '${field}'`)
                        }
                    }
                }
            }
        }
    }

    return counts
}

// --- Validate entity data without content pages ---

function validateEntityData() {
    // Check exchanges entity data (consumed directly by exchanges.ts loader)
    const exchangeDir = path.join(ROOT, 'input/data/exchanges')
    const exchangeFiles = listMdFiles(exchangeDir)

    for (const file of exchangeFiles) {
        const slug = file.replace('.md', '')
        const fm = readFrontmatter(path.join(exchangeDir, file))
        if (!fm) continue

        if (!fm.name) error(`input/data/exchanges/${file}: missing required field 'name'`)
        if (!fm.supported_networks) warn(`input/data/exchanges/${file}: missing 'supported_networks'`)
    }

    console.log(`  Exchange entities: ${exchangeFiles.length}`)
}

// --- Validate convert pairs ---

function validateConvertPairs() {
    const pairsPath = path.join(ROOT, 'content/convert/pairs.yaml')
    if (!fs.existsSync(pairsPath)) {
        // Try alternate location
        const altPath = path.join(ROOT, 'input/data/currencies/pairs.yaml')
        if (!fs.existsSync(altPath)) {
            warn('No convert pairs file found')
            return
        }
    }
}

// --- Run ---

console.log('\nValidating peanut-ui content...\n')

for (const config of CONTENT_TYPES) {
    const counts = validateContentType(config)
    const parts = [`${counts.total} entries`]
    if (counts.published > 0 || counts.draft > 0) {
        parts.push(`${counts.published} published, ${counts.draft} draft`)
    }
    if (counts.missingEn > 0) {
        parts.push(`${counts.missingEn} missing en.md`)
    }
    console.log(`  ${config.contentDir}: ${parts.join(' — ')}`)
}

validateEntityData()
validateConvertPairs()

console.log('')

if (warnings.length > 0) {
    console.log(`${warnings.length} warning(s):`)
    for (const w of warnings) console.log(`  ${w}`)
    console.log('')
}

if (errors.length > 0) {
    console.log(`${errors.length} error(s):`)
    for (const e of errors) console.log(`  ${e}`)
    console.log('')
    process.exit(1)
} else {
    console.log('All content valid!\n')
}
