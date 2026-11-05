/** @jest-environment node */
import fs from 'fs'
import path from 'path'

/*
 * viem's chain registry (~700 chains, ~120 KB gzip) loads on first use through
 * utils/chain-registry. A static namespace or default import of `viem/chains`
 * or `wagmi/chains` anywhere in src puts the whole registry back in every
 * bundle that reaches the module, the landing pages included. Named imports
 * (`import { arbitrum } from 'viem/chains'`) tree-shake and are fine.
 */
const SRC = path.join(process.cwd(), 'src')
const REGISTRY = /['"](?:viem|wagmi|@wagmi\/core)\/chains['"]/
const WHOLE_REGISTRY = [
    /import\s+\*\s+as\s+\w+\s+from\s+['"](?:viem|wagmi|@wagmi\/core)\/chains['"]/, // namespace import
    /import\s+\w+\s*(?:,\s*\{[^}]*\})?\s+from\s+['"](?:viem|wagmi|@wagmi\/core)\/chains['"]/, // default import
    /export\s+\*\s+(?:as\s+\w+\s+)?from\s+['"](?:viem|wagmi|@wagmi\/core)\/chains['"]/, // re-export
    /require\(\s*['"](?:viem|wagmi|@wagmi\/core)\/chains['"]\s*\)/, // sync require
]
// The one sanctioned load: a dynamic import(), which webpack splits into its own chunk.
const LOADER = 'src/utils/chain-registry.ts'
// Dead file: nothing imports it (asserted below), so its namespace import ships nowhere.
const DEAD = 'src/constants/chains.consts.ts'

function sourceFiles(dir: string): string[] {
    const files: string[] = []
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) {
            if (entry.name === '__tests__' || entry.name === 'node_modules') continue
            files.push(...sourceFiles(full))
        } else if (/\.(ts|tsx|js|jsx|mjs)$/.test(entry.name) && !/\.test\.[jt]sx?$/.test(entry.name)) {
            files.push(full)
        }
    }
    return files
}

const files = sourceFiles(SRC).map((file) => ({
    file: path.relative(process.cwd(), file),
    text: fs.readFileSync(file, 'utf8'),
}))

describe('viem chain registry stays lazy', () => {
    it('no source file imports the whole registry statically', () => {
        const offenders = files
            .filter(({ file }) => file !== DEAD)
            .filter(({ text }) => REGISTRY.test(text))
            .filter(({ text }) => WHOLE_REGISTRY.some((pattern) => pattern.test(text)))
            .map(({ file }) => file)
        expect(offenders).toEqual([])
    })

    it('the loader reaches the registry only through a dynamic import', () => {
        const loader = files.find(({ file }) => file === LOADER)
        expect(loader?.text).toMatch(/import\(\s*['"]viem\/chains['"]\s*\)/)
    })

    it('the dead chains.consts module stays unimported', () => {
        const importers = files.filter(({ text }) => /['"]@\/constants\/chains\.consts['"]/.test(text))
        expect(importers.map(({ file }) => file)).toEqual([])
    })
})
