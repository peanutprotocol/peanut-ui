import { execFileSync } from 'node:child_process'
import { fixtureIdentityFiles, fixtureRootFiles } from './capture-impact.mjs'
import { fileIdentity } from './capture-identity.mjs'

const git = (args) => execFileSync('git', args, { timeout: 60000, maxBuffer: 64 * 1024 * 1024 })

export function selectBeforeHarness({ before, after, runGit = git }) {
    if (![before, after].every((sha) => /^[a-f0-9]{40}$/.test(sha ?? '')))
        throw new Error('Before harness selection requires immutable revisions')
    const deadline = Date.now() + 120000
    const identities = [before, after].map((revision) => {
        const paths = String(runGit(['ls-tree', '-r', '--name-only', '-z', revision]))
            .split('\0')
            .filter(Boolean)
        if (paths.length > 20000) throw new Error('Before harness tree exceeds its bounded graph budget')
        const files = new Set(paths),
            cache = new Map()
        const readBytes = (path) => {
            if (Date.now() >= deadline) throw new Error('Before harness selection exceeded its 120-second budget')
            if (!cache.has(path)) cache.set(path, Buffer.from(runGit(['show', `${revision}:${path}`])))
            return cache.get(path)
        }
        const roots = fixtureRootFiles(files)
        if (roots.some((path) => !files.has(path))) return null
        const answers = ['scripts/screens/adapter.ts', 'scripts/screens/openapi-example.ts']
        if (answers.some((path) => !files.has(path))) return null
        const dependencies = fixtureIdentityFiles(roots, { files, read: (path) => readBytes(path).toString('utf8') })
        return fileIdentity([...dependencies, ...answers], readBytes)
    })
    // Harness-only fixes share head on both sides so they do not manufacture visual differences.
    return identities.every(Boolean) && identities[0] === identities[1] ? 'head' : 'base'
}

export function beforeBaseCapability({ read, only = '', fullCatalogue = false }) {
    try {
        const runner = read('scripts/screens/run-capture.mjs')
        const capture = read('scripts/screens/capture.ts')
        const flags = ['locale', ...(only ? ['scope', 'only'] : []), ...(fullCatalogue ? ['full-catalogue'] : [])]
        return flags.every((flag) => runner.includes(`--${flag}`) && new RegExp(`arg\\(['"]${flag}['"]`).test(capture))
    } catch (error) {
        if (error.code === 'ENOENT') return false
        throw error
    }
}
