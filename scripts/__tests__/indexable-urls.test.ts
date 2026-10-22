/** @jest-environment node */

import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { getIndexablePages } from '../../src/lib/seo/url-inventory'

const tsconfig = resolve('tsconfig.json')

function run(script: string, cwd: string, ...args: string[]): string[] {
    return execFileSync(
        process.execPath,
        [require.resolve('tsx/cli'), '--tsconfig', tsconfig, resolve('scripts', script), ...args],
        { cwd, encoding: 'utf8', stdio: 'pipe' }
    )
        .trim()
        .split('\n')
}

it('gives crawls and IndexNow exactly the canonical inventory', () => {
    const expected = getIndexablePages().map(({ path }) => `https://peanut.me${path}`)
    expect(run('list-indexable-urls.ts', process.cwd())).toEqual(expected)
    expect(run('ping-indexnow.ts', process.cwd(), '--dry-run')).toEqual(expected)
})

it('rejects explicit submissions outside the inventory and deduplicates canonical paths', () => {
    expect(() => run('ping-indexnow.ts', process.cwd(), '--dry-run', '/privacy')).toThrow(
        /Paths are not in the indexable URL inventory: \/privacy/
    )
    expect(run('ping-indexnow.ts', process.cwd(), '--dry-run', '/en/press', '/en/press')).toEqual([
        'https://peanut.me/en/press',
    ])
})

it('excludes missing locale files, drafts, redirects, and retired pages from crawl and submission lists', () => {
    const fixture = mkdtempSync(join(tmpdir(), 'seo-inventory-'))
    function article(relative: string, published = true) {
        const file = join(fixture, 'src/content/content', relative)
        mkdirSync(dirname(file), { recursive: true })
        writeFileSync(
            file,
            `---\ntitle: Test article\ndescription: Test article\npublished: ${published}\n---\nTest.\n`
        )
    }
    try {
        article('countries/test-country/en.md')
        article('countries/test-country/es-419.md', false)
        article('help/live-article/en.md')
        article('help/draft-article/en.md', false)
        article('blog/draft-post/en.md', false)
        article('receive-from/independent-source/en.md')
        article('press/en.md')
        article('press/pt-br.md', false)
        article('countries/united-kingdom/en.md')

        const urls = run('list-indexable-urls.ts', fixture)
        expect(urls).toContain('https://peanut.me/en/test-country')
        expect(urls).toContain('https://peanut.me/en/help/live-article')
        expect(urls).toContain('https://peanut.me/en/receive-money-from/independent-source')
        expect(urls).toContain('https://peanut.me/en/press')
        expect(urls).not.toContain('https://peanut.me/pt-br/press')
        expect(urls).not.toContain('https://peanut.me/es-419/test-country')
        expect(urls).not.toContain('https://peanut.me/pt-br/test-country')
        expect(urls.some((url) => url.includes('draft-'))).toBe(false)
        expect(urls).not.toContain('https://peanut.me/privacy')
        expect(urls).not.toContain('https://peanut.me/en/blog')
        expect(urls).not.toContain('https://peanut.me/en/united-kingdom')
        expect(run('ping-indexnow.ts', fixture, '--dry-run')).toEqual(urls)

        const verify = () =>
            spawnSync(
                process.execPath,
                [require.resolve('tsx/cli'), '--tsconfig', tsconfig, resolve('scripts/verify-content.ts')],
                { cwd: fixture, encoding: 'utf8' }
            ).stdout
        const missingPress = 'Sitemap would emit URL with no matching static route: /en/press'
        expect(verify()).toContain(missingPress)
        const pressRoute = join(fixture, 'src/app/[locale]/(marketing)/press')
        mkdirSync(pressRoute, { recursive: true })
        writeFileSync(join(pressRoute, 'page.tsx'), 'export default function Press() { return null }\n')
        expect(verify()).not.toContain(missingPress)
    } finally {
        rmSync(fixture, { recursive: true, force: true })
    }
})
