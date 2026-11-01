import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { createRequire } from 'node:module'
import { fixtureIdentityFiles } from './capture-impact.mjs'
import { fileIdentity } from './capture-identity.mjs'

const require = createRequire(import.meta.url)
let ts
try {
    ts = require('./publisher/node_modules/typescript')
} catch {
    ts = require('typescript')
}
export const REVISION_ADAPTER_VERSION = 'synthetic-api-v2'
export const API_INPUTS = [
    'src/dev/fixtures/registry.ts',
    'src/utils/demo-api.ts',
    'src/constants/residence.consts.ts',
    'src/types/api.openapi.json',
]
const adapterFile = 'scripts/screens/adapter.ts'

/** Read the compatibility declaration as syntax, never execute the source adapter. */
function adapterVersion(source) {
    const parsed = ts.createSourceFile(adapterFile, source, ts.ScriptTarget.Latest, true)
    for (const statement of parsed.statements) {
        if (
            !ts.isVariableStatement(statement) ||
            !statement.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
        )
            continue
        for (const declaration of statement.declarationList.declarations) {
            if (
                declaration.name.getText(parsed) === 'ADAPTER_VERSION' &&
                declaration.initializer &&
                ts.isStringLiteral(declaration.initializer)
            )
                return declaration.initializer.text
        }
    }
    return undefined
}

/** Also used by the trusted publisher: immutable blobs are read, never imported. */
export function captureFixtures(source, { revision } = {}) {
    const root = resolve(source)
    if (revision !== undefined && !/^[a-f0-9]{40}$/.test(revision))
        throw new Error('Expected immutable fixture revision')
    const git = (args, encoding = 'utf8') =>
        execFileSync('git', ['-C', root, ...args], { encoding, timeout: 60000, maxBuffer: 64 * 1024 * 1024 })
    const files = new Set(
        git(revision ? ['ls-tree', '-r', '--name-only', '-z', revision] : ['ls-files', '--cached', '-z'])
            .split('\0')
            .filter(Boolean)
    )
    const cache = new Map()
    const read = (path) => {
        if (!cache.has(path))
            cache.set(path, revision ? git(['show', `${revision}:${path}`], 'buffer') : readFileSync(join(root, path)))
        return cache.get(path)
    }
    const version = files.has(adapterFile) ? adapterVersion(read(adapterFile).toString('utf8')) : undefined
    const missing = API_INPUTS.filter((path) => !files.has(path))
    const unavailableReason =
        version !== REVISION_ADAPTER_VERSION
            ? `Revision API inputs unavailable: ${version ? `unsupported ADAPTER_VERSION ${version}` : 'revision predates a compatible API adapter'}`
            : missing.length
              ? `Revision API inputs unavailable: missing ${missing.join(', ')}`
              : undefined
    const roots = [adapterFile, ...API_INPUTS, 'package.json', 'pnpm-lock.yaml'].filter((path) => files.has(path))
    // The adapter's declaration is data; its imports belong to the head harness,
    // not to the source data graph. Missing inputs never fall back to head data.
    const inputs = unavailableReason
        ? roots
        : [
              adapterFile,
              ...fixtureIdentityFiles(
                  roots.filter((path) => path !== adapterFile),
                  { files, read: (path) => read(path).toString('utf8'), runtimeOnly: true }
              ),
          ]
    return { fixtures: fileIdentity(inputs, read), files: [...new Set(inputs)].sort(), version, unavailableReason }
}
