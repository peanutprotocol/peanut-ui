import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, posix, resolve } from 'node:path'
import { compileFunction } from 'node:vm'
import { compileFixtureModule } from './capture-impact.mjs'
import { ADAPTER_VERSION, createAnswer, type AdapterInputs } from './adapter'
import { captureFixtures } from './capture-fixtures.mjs'

/**
 * Load only the source API data graph. Never import its harness/adapter or apply
 * its tsconfig aliases. Each capture gets an independent local module cache.
 * This executes revision-owned data modules, not a sandbox for untrusted code;
 * it runs only in the existing isolated capture job, outside the publisher.
 */
export async function revisionAdapter(source: string) {
    const identity = captureFixtures(source)
    if (identity.unavailableReason)
        return { ...identity, adapter: ADAPTER_VERSION, hasFixture: () => false, answer: undefined }
    const root = resolve(source)
    const files = new Set(identity.files)
    const cache = new Map<string, { exports: unknown }>()
    const load = (path: string): unknown => {
        const previous = cache.get(path)
        if (previous) return previous.exports
        if (!path.startsWith('src/') || !files.has(path)) throw new Error(`Not a revision API input: ${path}`)
        const filename = join(root, path)
        const text = readFileSync(filename, 'utf8')
        const dataModule = { exports: {} as unknown }
        cache.set(path, dataModule)
        if (path.endsWith('.json')) dataModule.exports = JSON.parse(text)
        else {
            const externalRequire = createRequire(filename)
            const requireInput = (specifier: string) => {
                if (!specifier.startsWith('.') && !specifier.startsWith('@/')) return externalRequire(specifier)
                const base = posix.normalize(
                    specifier.startsWith('@/')
                        ? `src/${specifier.slice(2)}`
                        : posix.join(posix.dirname(path), specifier)
                )
                const resolved = [
                    base,
                    ...['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json'].map((ext) => base + ext),
                    ...['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].map((ext) => `${base}/index${ext}`),
                ].find((candidate) => files.has(candidate))
                if (!resolved) throw new Error(`Missing revision API dependency: ${specifier} from ${path}`)
                return load(resolved)
            }
            const compiled = compileFixtureModule(path, text)
            compileFunction(compiled, ['exports', 'require', 'module', '__filename', '__dirname'], {
                filename,
            })(dataModule.exports, requireInput, dataModule, filename, dirname(filename))
        }
        return dataModule.exports
    }
    const { FIXTURES } = load('src/dev/fixtures/registry.ts') as { FIXTURES: AdapterInputs['fixtures'] }
    const { demoRespond } = load('src/utils/demo-api.ts') as Pick<AdapterInputs, 'demoRespond'>
    const residence = load('src/constants/residence.consts.ts') as AdapterInputs['residence']
    const openapi = load('src/types/api.openapi.json')
    if (!FIXTURES || typeof demoRespond !== 'function') throw new Error('Invalid revision API input exports')
    return {
        ...identity,
        adapter: ADAPTER_VERSION,
        hasFixture: (name: string) => Object.hasOwn(FIXTURES, name),
        answer: createAnswer({ fixtures: FIXTURES, demoRespond, residence, openapi }),
    }
}
