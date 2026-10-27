/** @jest-environment node */

import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const generator = resolve('scripts/generate-signup-attribution-paths.ts')
const tsconfig = resolve('tsconfig.json')

function generate(cwd: string, ...args: string[]): void {
    execFileSync(process.execPath, [require.resolve('tsx/cli'), '--tsconfig', tsconfig, generator, ...args], {
        cwd,
        stdio: 'pipe',
    })
}

it('keeps the browser attribution inventory in sync with the actual sitemap', () => {
    expect(() => generate(process.cwd(), '--check')).not.toThrow()
})

it('includes newly published articles and locale fallbacks without editing the manifest', () => {
    const fixture = mkdtempSync(join(tmpdir(), 'signup-attribution-content-'))
    try {
        const content = join(fixture, 'src/content/content')
        mkdirSync(content, { recursive: true })
        mkdirSync(join(fixture, 'src/constants'), { recursive: true })
        generate(fixture)

        const article = join(content, 'blog/new-public-article')
        mkdirSync(article, { recursive: true })
        writeFileSync(
            join(article, 'en.md'),
            '---\ntitle: New article\ndescription: New article\n---\nPublic content.\n'
        )
        expect(() => generate(fixture, '--check')).toThrow()
        generate(fixture)

        const paths = JSON.parse(
            readFileSync(join(fixture, 'src/constants/signup-attribution-paths.generated.json'), 'utf8')
        )
        expect(paths).toEqual(
            expect.arrayContaining([
                '/en/blog/new-public-article',
                '/es-419/blog/new-public-article',
                '/es-ar/blog/new-public-article',
                '/pt-br/blog/new-public-article',
            ])
        )
        expect(() => generate(fixture, '--check')).not.toThrow()
    } finally {
        rmSync(fixture, { recursive: true, force: true })
    }
})
