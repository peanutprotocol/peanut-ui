#!/usr/bin/env tsx
/**
 * Comprehensive content verification for peanut-ui.
 * Replaces validate-links.ts with broader checks.
 *
 * Run: pnpm verify-content
 *
 * Checks:
 * 1. Internal link validation (published content → valid routes)
 * 2. Published content has matching route (no catch-all fallback)
 * 3. Footer manifest URL validation
 * 4. Frontmatter consistency (title, description, published field)
 * 5. Cross-locale coverage warnings
 */

import fs from 'fs'
import path from 'path'

const ROOT = path.join(process.cwd(), 'src/content')
const CONTENT_DIR = path.join(ROOT, 'content')
const APP_DIR = path.join(process.cwd(), 'src/app/[locale]/(marketing)')

const SUPPORTED_LOCALES = ['en', 'es-419', 'es-ar', 'es-es', 'pt-br']
const PRIMARY_LOCALES = ['en', 'es-419', 'pt-br']

// Exchange entity slugs (from input/data/exchanges/) — used to distinguish from- vs via- deposit URLs
const exchangeSlugs = listEntitySlugs('exchanges')

// --- Diagnostics ---

interface Diagnostic {
    level: 'error' | 'warning'
    check: string
    file?: string
    line?: number
    message: string
}

const diagnostics: Diagnostic[] = []

function error(check: string, message: string, file?: string, line?: number) {
    diagnostics.push({ level: 'error', check, file, line, message })
}

function warn(check: string, message: string, file?: string) {
    diagnostics.push({ level: 'warning', check, file, message })
}

// --- Filesystem helpers ---

function listDirs(dir: string): string[] {
    if (!fs.existsSync(dir)) return []
    return fs
        .readdirSync(dir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
}

function listEntitySlugs(category: string): string[] {
    const dir = path.join(ROOT, 'input/data', category)
    if (!fs.existsSync(dir)) return []
    return fs
        .readdirSync(dir)
        .filter((f) => f.endsWith('.md'))
        .map((f) => f.replace('.md', ''))
}

function getAllMdFiles(dir: string): string[] {
    const results: string[] = []
    if (!fs.existsSync(dir)) return results
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) {
            if (entry.name === 'deprecated') continue
            results.push(...getAllMdFiles(full))
        } else if (entry.name.endsWith('.md')) {
            results.push(full)
        }
    }
    return results
}

function rel(filePath: string): string {
    return path.relative(process.cwd(), filePath)
}

// --- Frontmatter parsing ---

function parseFrontmatter(content: string): Record<string, unknown> {
    const match = content.match(/^---\n([\s\S]*?)\n---/)
    if (!match) return {}
    const frontmatter: Record<string, unknown> = {}
    for (const line of match[1].split('\n')) {
        const colonIdx = line.indexOf(':')
        if (colonIdx === -1) continue
        const key = line.slice(0, colonIdx).trim()
        let value: string | boolean = line.slice(colonIdx + 1).trim()
        if (value === 'true') value = true
        else if (value === 'false') value = false
        // Strip quotes
        if (
            typeof value === 'string' &&
            ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
        ) {
            value = value.slice(1, -1)
        }
        frontmatter[key] = value
    }
    return frontmatter
}

function isPublished(content: string): boolean {
    const fm = parseFrontmatter(content)
    return fm.published !== false
}

// --- Build valid paths from actual routes ---

function discoverRoutes(): Set<string> {
    const routes = new Set<string>()

    // Static pages
    for (const p of ['/', '/careers', '/exchange', '/privacy', '/terms', '/lp/card']) {
        routes.add(p)
    }

    // App routes (mobile-ui)
    for (const p of [
        '/profile',
        '/profile/backup',
        '/profile/edit',
        '/profile/exchange-rate',
        '/profile/identity-verification',
        '/home',
        '/send',
        '/request',
        '/settings',
        '/history',
        '/points',
        '/recover-funds',
    ]) {
        routes.add(p)
    }

    // Discover content-driven routes from actual page.tsx files + content dirs
    const countrySlugs = listDirs(path.join(CONTENT_DIR, 'countries'))
    const competitorSlugs = listDirs(path.join(CONTENT_DIR, 'compare'))
    const payWithSlugs = listDirs(path.join(CONTENT_DIR, 'pay-with'))
    const depositSlugs = listDirs(path.join(CONTENT_DIR, 'deposit'))
    const helpSlugs = listDirs(path.join(CONTENT_DIR, 'help'))
    const useCaseSlugs = listDirs(path.join(CONTENT_DIR, 'use-cases'))
    const storySlugs = listDirs(path.join(CONTENT_DIR, 'stories')).filter((s) => s !== 'index')
    const withdrawSlugs = listDirs(path.join(CONTENT_DIR, 'withdraw'))

    // Corridors
    const corridors: Array<{ to: string; from: string }> = []
    for (const dest of listDirs(path.join(CONTENT_DIR, 'send-to'))) {
        const fromDir = path.join(CONTENT_DIR, 'send-to', dest, 'from')
        for (const origin of listDirs(fromDir)) {
            corridors.push({ to: dest, from: origin })
        }
    }
    const receiveSources = [...new Set(corridors.map((c) => c.from))]

    // Check which routes actually have page.tsx files
    const hasRoute = (routePath: string) => {
        const pagePath = path.join(APP_DIR, routePath, 'page.tsx')
        return fs.existsSync(pagePath)
    }

    for (const locale of SUPPORTED_LOCALES) {
        // Country hub: [country]/page.tsx
        if (hasRoute('[country]')) {
            for (const slug of countrySlugs) routes.add(`/${locale}/${slug}`)
        }

        // Send money to
        if (hasRoute('send-money-to/[country]')) {
            for (const slug of countrySlugs) routes.add(`/${locale}/send-money-to/${slug}`)
        }

        // Corridors
        if (hasRoute('send-money-from/[from]/to/[to]')) {
            for (const c of corridors) routes.add(`/${locale}/send-money-from/${c.from}/to/${c.to}`)
        }

        // Receive money
        if (hasRoute('receive-money-from/[country]')) {
            for (const source of receiveSources) routes.add(`/${locale}/receive-money-from/${source}`)
        }

        // Compare
        if (hasRoute('compare/[slug]')) {
            for (const slug of competitorSlugs) routes.add(`/${locale}/compare/peanut-vs-${slug}`)
        }

        // Pay with
        if (hasRoute('pay-with/[method]')) {
            for (const slug of payWithSlugs) routes.add(`/${locale}/pay-with/${slug}`)
        }

        // Deposit — exchanges use from- prefix, rails use via- prefix
        if (hasRoute('deposit/[exchange]')) {
            for (const slug of exchangeSlugs) routes.add(`/${locale}/deposit/from-${slug}`)
            for (const slug of depositSlugs) {
                if (exchangeSlugs.includes(slug)) {
                    routes.add(`/${locale}/deposit/from-${slug}`)
                } else {
                    routes.add(`/${locale}/deposit/via-${slug}`)
                }
            }
        }

        // Help
        if (hasRoute('help/[slug]')) {
            routes.add(`/${locale}/help`)
            routes.add('/help')
            for (const slug of helpSlugs) {
                routes.add(`/${locale}/help/${slug}`)
                routes.add(`/help/${slug}`)
            }
        }

        // Use cases
        if (hasRoute('use-cases/[slug]')) {
            for (const slug of useCaseSlugs) routes.add(`/${locale}/use-cases/${slug}`)
        }

        // Stories
        if (hasRoute('stories/[slug]')) {
            routes.add(`/${locale}/stories`)
            for (const slug of storySlugs) routes.add(`/${locale}/stories/${slug}`)
        }

        // Withdraw
        if (hasRoute('withdraw/[slug]')) {
            for (const slug of withdrawSlugs) {
                routes.add(`/${locale}/withdraw/${slug}`)
            }
        }

        // Pricing (singleton)
        if (hasRoute('pricing')) {
            routes.add(`/${locale}/pricing`)
        }

        // Supported networks (singleton)
        if (hasRoute('supported-networks')) {
            routes.add(`/${locale}/supported-networks`)
        }
    }

    return routes
}

// --- Link extraction ---

const MARKDOWN_LINK_RE = /\[([^\]]*)\]\((\/?[^)]+)\)/g
const JSX_HREF_RE = /href=["'](\/[^"']+)["']/g

function extractLinks(content: string): Array<{ line: number; url: string; text: string }> {
    const links: Array<{ line: number; url: string; text: string }> = []
    const lines = content.split('\n')
    for (let i = 0; i < lines.length; i++) {
        const lineContent = lines[i]
        if (lineContent.trim().startsWith('content/')) continue

        let match
        MARKDOWN_LINK_RE.lastIndex = 0
        while ((match = MARKDOWN_LINK_RE.exec(lineContent)) !== null) {
            if (isInternalLink(match[2])) links.push({ line: i + 1, url: match[2], text: match[1] })
        }
        JSX_HREF_RE.lastIndex = 0
        while ((match = JSX_HREF_RE.exec(lineContent)) !== null) {
            if (isInternalLink(match[1])) links.push({ line: i + 1, url: match[1], text: '' })
        }
    }
    return links
}

function isInternalLink(url: string): boolean {
    if (!url.startsWith('/')) return false
    if (url.startsWith('//')) return false
    if (url === '/') return true
    if (url.startsWith('/api/')) return false
    if (url.startsWith('/#')) return false
    if (url.match(/\.(png|jpg|jpeg|gif|svg|webp|ico)$/i)) return false
    return true
}

function cleanUrl(url: string): string {
    return url.split('?')[0].split('#')[0].replace(/\/$/, '')
}

// --- Pass 1: Internal link validation ---

function checkLinks(validPaths: Set<string>) {
    const files = getAllMdFiles(CONTENT_DIR)
    let totalLinks = 0
    let skippedUnpublished = 0

    for (const file of files) {
        const content = fs.readFileSync(file, 'utf-8')
        if (!isPublished(content)) {
            skippedUnpublished++
            continue
        }

        const links = extractLinks(content)
        totalLinks += links.length

        for (const link of links) {
            const clean = cleanUrl(link.url)
            if (!validPaths.has(clean)) {
                error(
                    'broken-link',
                    `Broken link: ${link.url}${link.text ? ` "${link.text}"` : ''}`,
                    rel(file),
                    link.line
                )
            }
        }
    }

    console.log(
        `  Pass 1 — Links: checked ${totalLinks} links across ${files.length - skippedUnpublished} published files (${skippedUnpublished} unpublished skipped)`
    )
}

// --- Pass 2: Published content has matching route ---

function checkPublishedHasRoute(validPaths: Set<string>) {
    const contentTypes: Array<{ dir: string; urlPattern: (locale: string, slug: string) => string }> = [
        { dir: 'countries', urlPattern: (l, s) => `/${l}/${s}` },
        { dir: 'help', urlPattern: (l, s) => `/${l}/help/${s}` },
        { dir: 'compare', urlPattern: (l, s) => `/${l}/compare/peanut-vs-${s}` },
        { dir: 'pay-with', urlPattern: (l, s) => `/${l}/pay-with/${s}` },
        {
            dir: 'deposit',
            urlPattern: (l, s) => {
                const isExchange = exchangeSlugs.includes(s)
                return `/${l}/deposit/${isExchange ? 'from' : 'via'}-${s}`
            },
        },
        { dir: 'use-cases', urlPattern: (l, s) => `/${l}/use-cases/${s}` },
        { dir: 'stories', urlPattern: (l, s) => `/${l}/stories/${s}` },
        { dir: 'withdraw', urlPattern: (l, s) => `/${l}/withdraw/${s}` },
    ]

    let issues = 0
    for (const ct of contentTypes) {
        const slugs = listDirs(path.join(CONTENT_DIR, ct.dir)).filter((s) => s !== 'index')
        for (const slug of slugs) {
            const enFile = path.join(CONTENT_DIR, ct.dir, slug, 'en.md')
            if (!fs.existsSync(enFile)) continue
            const content = fs.readFileSync(enFile, 'utf-8')
            if (!isPublished(content)) continue

            const url = ct.urlPattern('en', slug)
            if (!validPaths.has(url)) {
                error('no-route', `Published content has no route: ${url}`, rel(enFile))
                issues++
            }
        }
    }

    // Singleton content types
    for (const intent of ['pricing', 'supported-networks']) {
        const enFile = path.join(CONTENT_DIR, intent, 'en.md')
        if (!fs.existsSync(enFile)) continue
        const content = fs.readFileSync(enFile, 'utf-8')
        if (!isPublished(content)) continue

        const url = `/en/${intent}`
        if (!validPaths.has(url)) {
            error('no-route', `Published singleton has no route: ${url}`, rel(enFile))
            issues++
        }
    }

    console.log(`  Pass 2 — Route coverage: ${issues === 0 ? 'all published content has routes' : `${issues} issues`}`)
}

// --- Pass 3: Footer manifest validation ---

function checkFooterManifest(validPaths: Set<string>) {
    const manifestPath = path.join(ROOT, 'generated/footer-manifest.json')
    if (!fs.existsSync(manifestPath)) {
        warn('footer', 'No footer-manifest.json found')
        return
    }

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
    let issues = 0

    function checkEntries(entries: Array<{ href: string; slug: string; external?: boolean }>, section: string) {
        for (const entry of entries) {
            if (entry.external) continue
            const clean = cleanUrl(entry.href)
            if (!validPaths.has(clean)) {
                error(
                    'footer',
                    `Footer manifest "${section}" links to non-existent route: ${entry.href}`,
                    rel(manifestPath)
                )
                issues++
            }
        }
    }

    if (manifest.sendMoney?.to) checkEntries(manifest.sendMoney.to, 'sendMoney.to')
    if (manifest.sendMoney?.from) checkEntries(manifest.sendMoney.from, 'sendMoney.from')
    if (manifest.compare) checkEntries(manifest.compare, 'compare')
    if (manifest.articles) checkEntries(manifest.articles, 'articles')
    if (manifest.resources) checkEntries(manifest.resources, 'resources')

    console.log(`  Pass 3 — Footer manifest: ${issues === 0 ? 'all URLs valid' : `${issues} broken URLs`}`)
}

// --- Pass 4: Frontmatter consistency ---

function checkFrontmatter() {
    const files = getAllMdFiles(CONTENT_DIR)
    let issues = 0

    for (const file of files) {
        const content = fs.readFileSync(file, 'utf-8')
        const fm = parseFrontmatter(content)

        if (!isPublished(content)) continue

        if (!fm.title || (typeof fm.title === 'string' && fm.title.trim() === '')) {
            error('frontmatter', 'Published file missing title', rel(file))
            issues++
        }
        if (!fm.description || (typeof fm.description === 'string' && fm.description.trim() === '')) {
            error('frontmatter', 'Published file missing description', rel(file))
            issues++
        }
        // published field is now optional — missing defaults to published
    }

    console.log(`  Pass 4 — Frontmatter: ${issues === 0 ? 'all published files valid' : `${issues} issues`}`)
}

// --- Pass 5: Cross-locale coverage ---

function checkLocaleCoverage() {
    const contentTypes = ['countries', 'help', 'compare', 'pay-with', 'use-cases', 'deposit']
    let warnings = 0

    for (const ct of contentTypes) {
        const slugs = listDirs(path.join(CONTENT_DIR, ct))
        for (const slug of slugs) {
            const slugDir = path.join(CONTENT_DIR, ct, slug)
            const enFile = path.join(slugDir, 'en.md')
            if (!fs.existsSync(enFile)) continue
            const content = fs.readFileSync(enFile, 'utf-8')
            if (!isPublished(content)) continue

            for (const locale of PRIMARY_LOCALES) {
                if (locale === 'en') continue
                if (!fs.existsSync(path.join(slugDir, `${locale}.md`))) {
                    warn('locale', `${ct}/${slug}: missing ${locale} translation`, rel(enFile))
                    warnings++
                }
            }
        }
    }

    console.log(`  Pass 5 — Locale coverage: ${warnings} missing translations (warnings only)`)
}

// --- Pass 6: Content polish (MDX component usage) ---

/** MDX components that indicate a polished page */
const MDX_COMPONENT_PATTERNS = [
    /<Hero\b/,
    /<Callout\b/,
    /<RelatedPages\b/,
    /<CountryGrid\b/,
    /<ComparisonTable\b/,
    /<FAQ\b/,
    /<Steps\b/,
]

/** Minimum MDX component count for a page to be considered polished */
const MIN_MDX_COMPONENTS = 2

function checkContentPolish() {
    const files = getAllMdFiles(CONTENT_DIR)
    let errors = 0
    let warnings = 0

    for (const file of files) {
        const content = fs.readFileSync(file, 'utf-8')
        if (!isPublished(content)) continue

        const fm = parseFrontmatter(content)

        // Frontmatter override: skip_polish_check: true bypasses this check
        if (fm.skip_polish_check === true) continue

        const mdxCount = MDX_COMPONENT_PATTERNS.filter((pattern) => pattern.test(content)).length

        if (mdxCount === 0) {
            error(
                'polish',
                'Published page has zero MDX components — needs at least Hero + one other (FAQ, Steps, RelatedPages). Add skip_polish_check: true to frontmatter to override.',
                rel(file)
            )
            errors++
        } else if (mdxCount < MIN_MDX_COMPONENTS) {
            warn(
                'polish',
                `Only ${mdxCount} MDX component type(s) — consider adding FAQ, Steps, or RelatedPages for better SEO/UX. Add skip_polish_check: true to override.`,
                rel(file)
            )
            warnings++
        }
    }

    console.log(
        `  Pass 6 — Content polish: ${errors} errors, ${warnings} warnings (${errors + warnings === 0 ? 'all pages polished' : 'see details'})`
    )
}

// --- Pass 7: Check for published: false files (drafts) ---
// With the flipped default (missing = published), only published: false is meaningful.
// This pass just reports how many drafts exist for visibility.

function checkExplicitPublished() {
    const files = getAllMdFiles(CONTENT_DIR)
    let drafts = 0

    for (const file of files) {
        const content = fs.readFileSync(file, 'utf-8')
        const fm = parseFrontmatter(content)

        if (fm.published === false) {
            warn(
                'draft-content',
                'File is explicitly unpublished (draft)',
                rel(file)
            )
            drafts++
        }
    }

    console.log(
        `  Pass 7 — Drafts: ${drafts === 0 ? 'no draft files' : `${drafts} files marked as drafts (published: false)`}`
    )
}

// --- Pass 8: isPublished consistency ---
// Both page-level and lib now agree: missing/true = published, false = unpublished.
// This pass is kept as a no-op placeholder for numbering stability.

function checkPublishedConsistency() {
    console.log(
        '  Pass 8 — Published consistency: unified (both default to published)'
    )
}

// --- Pass 9: Submodule freshness ---
// Warn if content submodule is behind origin/main

function checkSubmoduleFreshness() {
    const contentGitDir = path.join(ROOT, '.git')
    if (!fs.existsSync(contentGitDir)) return

    try {
        const { execFileSync } = require('child_process')
        const behindCount = execFileSync(
            'git',
            ['-C', ROOT, 'rev-list', '--count', 'HEAD..origin/main'],
            { encoding: 'utf-8' }
        ).trim()
        const behind = parseInt(behindCount, 10)
        if (behind > 0) {
            warn('submodule', `Content submodule is ${behind} commit(s) behind origin/main — consider bumping`)
        }
        console.log(
            `  Pass 9 — Submodule freshness: ${behind === 0 ? 'up to date' : `${behind} commits behind origin/main`}`
        )
    } catch {
        console.log('  Pass 9 — Submodule freshness: skipped (not a git repo)')
    }
}

// --- Pass 10: Published page count regression ---
// Prevents accidental mass-unpublish (like the 72-page incident from commit 79cb1cd).
// Stores the last known count in a .verify-content-baseline file.

const BASELINE_FILE = path.join(process.cwd(), '.verify-content-baseline')

function checkPageCountRegression() {
    const files = getAllMdFiles(CONTENT_DIR)
    const publishedCount = files.filter((f) => {
        const content = fs.readFileSync(f, 'utf-8')
        return isPublished(content)
    }).length

    let baseline = 0
    let hasBaseline = false

    if (fs.existsSync(BASELINE_FILE)) {
        const raw = fs.readFileSync(BASELINE_FILE, 'utf-8').trim()
        baseline = parseInt(raw, 10)
        hasBaseline = true
    }

    if (hasBaseline && publishedCount < baseline) {
        const drop = baseline - publishedCount
        const pct = Math.round((drop / baseline) * 100)
        error(
            'page-count',
            `Published page count dropped from ${baseline} to ${publishedCount} (−${drop}, −${pct}%). This may indicate accidental mass-unpublish. If intentional, run: echo ${publishedCount} > .verify-content-baseline`
        )
    }

    // Update baseline (only if count went up or file doesn't exist)
    if (publishedCount >= baseline) {
        fs.writeFileSync(BASELINE_FILE, String(publishedCount) + '\n')
    }

    console.log(
        `  Pass 10 — Page count: ${publishedCount} published${hasBaseline ? ` (baseline: ${baseline})` : ' (baseline set)'}`
    )
}

// --- Main ---

function main() {
    console.log('Peanut Content Verification\n')

    console.log('Building route index from actual page.tsx files...')
    const validPaths = discoverRoutes()
    console.log(`  ${validPaths.size} valid paths indexed\n`)

    console.log('Running checks...')
    checkLinks(validPaths)
    checkPublishedHasRoute(validPaths)
    checkFooterManifest(validPaths)
    checkFrontmatter()
    checkLocaleCoverage()
    checkContentPolish()
    checkExplicitPublished()
    checkPublishedConsistency()
    checkSubmoduleFreshness()
    checkPageCountRegression()

    // Report
    const errors = diagnostics.filter((d) => d.level === 'error')
    const warnings = diagnostics.filter((d) => d.level === 'warning')

    console.log('\n' + '='.repeat(60))

    if (errors.length > 0) {
        console.log(`\n✗ ${errors.length} error(s):\n`)
        const byCheck = new Map<string, Diagnostic[]>()
        for (const e of errors) {
            const existing = byCheck.get(e.check) || []
            existing.push(e)
            byCheck.set(e.check, existing)
        }
        for (const [check, items] of byCheck) {
            console.log(`  [${check}]`)
            for (const item of items) {
                const loc = item.file ? `  ${item.file}${item.line ? `:${item.line}` : ''}` : ''
                console.log(`   ${loc} ${item.message}`)
            }
            console.log()
        }
    }

    if (warnings.length > 0) {
        console.log(`\n⚠ ${warnings.length} warning(s) (non-blocking)`)
    }

    if (errors.length === 0) {
        console.log('\n✓ All checks passed!')
        process.exit(0)
    } else {
        console.log(`\nResult: ${errors.length} errors, ${warnings.length} warnings`)
        process.exit(1)
    }
}

main()
