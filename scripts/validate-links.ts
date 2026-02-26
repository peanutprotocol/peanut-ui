#!/usr/bin/env tsx
/**
 * Internal link validation for peanut-ui content.
 * Run: pnpm validate-links
 *
 * Scans all .md files in src/content/content/ and validates that every
 * internal link points to a route that exists in the app.
 */

import fs from 'fs'
import path from 'path'

const ROOT = path.join(process.cwd(), 'src/content')
const CONTENT_DIR = path.join(ROOT, 'content')

// --- Build valid URL index ---

const SUPPORTED_LOCALES = ['en', 'es-419', 'es-ar', 'es-es', 'pt-br']

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

function buildValidPaths(): Set<string> {
    const paths = new Set<string>()

    // Static pages (no locale prefix)
    for (const p of ['/', '/careers', '/exchange', '/privacy', '/terms', '/lp/card']) {
        paths.add(p)
    }

    const countrySlugs = listDirs(path.join(CONTENT_DIR, 'countries'))
    const competitorSlugs = listDirs(path.join(CONTENT_DIR, 'compare'))
    const payWithSlugs = listDirs(path.join(CONTENT_DIR, 'pay-with'))
    const depositSlugs = listDirs(path.join(CONTENT_DIR, 'deposit'))
    const helpSlugs = listDirs(path.join(CONTENT_DIR, 'help'))
    const useCaseSlugs = listDirs(path.join(CONTENT_DIR, 'use-cases'))
    const withdrawSlugs = listDirs(path.join(CONTENT_DIR, 'withdraw'))
    const exchangeSlugs = listEntitySlugs('exchanges')

    // Also check for corridor pages: send-to/{country}/from/{origin}/
    const corridors: Array<{ to: string; from: string }> = []
    for (const dest of listDirs(path.join(CONTENT_DIR, 'send-to'))) {
        const fromDir = path.join(CONTENT_DIR, 'send-to', dest, 'from')
        for (const origin of listDirs(fromDir)) {
            corridors.push({ to: dest, from: origin })
        }
    }

    // Receive-money sources (unique "from" values in corridors)
    const receiveSources = [...new Set(corridors.map((c) => c.from))]

    for (const locale of SUPPORTED_LOCALES) {
        // Country hub pages: /{locale}/{country}
        for (const slug of countrySlugs) {
            paths.add(`/${locale}/${slug}`)
        }

        // Send-money-to: /{locale}/send-money-to/{country}
        for (const slug of countrySlugs) {
            paths.add(`/${locale}/send-money-to/${slug}`)
        }

        // Corridors: /{locale}/send-money-from/{from}/to/{to}
        for (const c of corridors) {
            paths.add(`/${locale}/send-money-from/${c.from}/to/${c.to}`)
        }

        // Receive money: /{locale}/receive-money-from/{source}
        for (const source of receiveSources) {
            paths.add(`/${locale}/receive-money-from/${source}`)
        }

        // Compare: /{locale}/compare/peanut-vs-{slug}
        for (const slug of competitorSlugs) {
            paths.add(`/${locale}/compare/peanut-vs-${slug}`)
        }

        // Pay-with: /{locale}/pay-with/{method}
        for (const slug of payWithSlugs) {
            paths.add(`/${locale}/pay-with/${slug}`)
        }

        // Deposit: /{locale}/deposit/from-{exchange}
        for (const slug of depositSlugs) {
            paths.add(`/${locale}/deposit/from-${slug}`)
        }
        // Also add exchange entity slugs (may differ from content dirs)
        for (const slug of exchangeSlugs) {
            paths.add(`/${locale}/deposit/from-${slug}`)
        }

        // Help: /{locale}/help and /{locale}/help/{slug}
        paths.add(`/${locale}/help`)
        for (const slug of helpSlugs) {
            paths.add(`/${locale}/help/${slug}`)
        }

        // Use-cases: /{locale}/use-cases/{slug}
        for (const slug of useCaseSlugs) {
            paths.add(`/${locale}/use-cases/${slug}`)
        }

        // Withdraw: /{locale}/withdraw/{slug}
        for (const slug of withdrawSlugs) {
            paths.add(`/${locale}/withdraw/to-${slug}`)
            // Also allow without prefix in case route doesn't use one
            paths.add(`/${locale}/withdraw/${slug}`)
        }

        // Pricing
        paths.add(`/${locale}/pricing`)
    }

    return paths
}

// --- Extract links from markdown ---

interface BrokenLink {
    file: string
    line: number
    url: string
    text: string
}

const MARKDOWN_LINK_RE = /\[([^\]]*)\]\((\/?[^)]+)\)/g
const JSX_HREF_RE = /href="(\/[^"]+)"/g

function extractLinks(content: string): Array<{ line: number; url: string; text: string }> {
    const links: Array<{ line: number; url: string; text: string }> = []
    const lines = content.split('\n')

    for (let i = 0; i < lines.length; i++) {
        const lineContent = lines[i]

        // Skip frontmatter alternates (they're file paths, not URLs)
        if (lineContent.trim().startsWith('content/')) continue

        // Markdown links: [text](/path)
        let match
        MARKDOWN_LINK_RE.lastIndex = 0
        while ((match = MARKDOWN_LINK_RE.exec(lineContent)) !== null) {
            const url = match[2]
            if (isInternalLink(url)) {
                links.push({ line: i + 1, url, text: match[1] })
            }
        }

        // JSX href="/path"
        JSX_HREF_RE.lastIndex = 0
        while ((match = JSX_HREF_RE.exec(lineContent)) !== null) {
            const url = match[1]
            if (isInternalLink(url)) {
                links.push({ line: i + 1, url, text: '' })
            }
        }
    }

    return links
}

function isInternalLink(url: string): boolean {
    if (!url.startsWith('/')) return false
    if (url.startsWith('//')) return false // protocol-relative
    if (url === '/') return true
    // Skip anchor links, API routes, images
    if (url.startsWith('/api/')) return false
    if (url.startsWith('/#')) return false
    if (url.match(/\.(png|jpg|jpeg|gif|svg|webp|ico)$/i)) return false
    return true
}

// --- Scan content files ---

function getAllMdFiles(dir: string): string[] {
    const results: string[] = []
    if (!fs.existsSync(dir)) return results

    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) {
            // Skip deprecated content
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

// --- Main ---

function main() {
    console.log('Building valid URL index...')
    const validPaths = buildValidPaths()
    console.log(`  ${validPaths.size} valid paths indexed\n`)

    console.log('Scanning content files...')
    const files = getAllMdFiles(CONTENT_DIR)
    console.log(`  ${files.length} markdown files found\n`)

    const broken: BrokenLink[] = []
    let totalLinks = 0

    for (const file of files) {
        const content = fs.readFileSync(file, 'utf-8')
        const links = extractLinks(content)
        totalLinks += links.length

        for (const link of links) {
            // Strip query string and hash for validation
            const cleanUrl = link.url.split('?')[0].split('#')[0]

            if (!validPaths.has(cleanUrl)) {
                broken.push({
                    file: rel(file),
                    line: link.line,
                    url: link.url,
                    text: link.text,
                })
            }
        }
    }

    // --- Report ---
    console.log(`Checked ${totalLinks} internal links across ${files.length} files\n`)

    if (broken.length === 0) {
        console.log('✓ No broken internal links found!')
        process.exit(0)
    }

    console.log(`✗ ${broken.length} broken internal links found:\n`)

    // Group by file
    const byFile = new Map<string, BrokenLink[]>()
    for (const b of broken) {
        const existing = byFile.get(b.file) || []
        existing.push(b)
        byFile.set(b.file, existing)
    }

    for (const [file, links] of byFile) {
        console.log(`  ${file}`)
        for (const link of links) {
            const textInfo = link.text ? ` "${link.text}"` : ''
            console.log(`    L${link.line}: ${link.url}${textInfo}`)
        }
        console.log()
    }

    process.exit(1)
}

main()
