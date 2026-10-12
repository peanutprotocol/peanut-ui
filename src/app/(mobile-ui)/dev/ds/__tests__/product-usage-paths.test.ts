import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

// every <ProductUsage.Example path="..."> cites a real call site. a rename in
// the app silently turns the citation into a lie — this fails instead.
const DS_ROOT = join(__dirname, '..')
const REPO_ROOT = join(DS_ROOT, '..', '..', '..', '..', '..')

const pagePaths = (tier: string) =>
    readdirSync(join(DS_ROOT, tier), { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .flatMap((e) => {
            const page = join(DS_ROOT, tier, e.name, 'page.tsx')
            if (!existsSync(page)) return []
            const cited = readFileSync(page, 'utf8').matchAll(/path="([^"]+)"/g)
            return [...cited].map((m) => [`${tier}/${e.name}`, m[1]] as const)
        })

const cases = [...pagePaths('primitives'), ...pagePaths('patterns')]

describe('ProductUsage.Example paths', () => {
    it('cites at least one call site', () => {
        expect(cases.length).toBeGreaterThan(0)
    })

    it.each(cases)('%s cites an existing file: %s', (_page, path) => {
        expect(existsSync(join(REPO_ROOT, path))).toBe(true)
    })
})
