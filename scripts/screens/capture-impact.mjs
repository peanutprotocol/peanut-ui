import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { posix } from 'node:path'
import { planCapture, knownNonvisual } from './capture-plan.mjs'
import { routePatternFor } from './routes.mjs'
const require = createRequire(import.meta.url)
let ts
try {
    ts = require('./publisher/node_modules/typescript')
} catch {
    ts = require('typescript')
}

export const trustedCatalogue = JSON.parse(readFileSync(new URL('./capture-catalogue.json', import.meta.url), 'utf8'))
const code = /\.[cm]?[jt]sx?$/
const sha = /^[a-f0-9]{40}$/
const git = (args, input) =>
    execFileSync('git', args, {
        encoding: 'utf8',
        input,
        maxBuffer: 64 * 1024 * 1024,
        timeout: 60000,
    })

export function changedPaths(before, after, runGit = git) {
    if (!sha.test(before) || !sha.test(after)) throw new Error('Expected exact impact revisions')
    return runGit(['diff', '--name-only', '--no-renames', '-z', before, after, '--']).split('\0').filter(Boolean)
}

/** Known nonvisual decisions need no compiler, app dependencies or browser. */
export function earlyCaptureMode(event, changedFiles) {
    return event !== 'workflow_dispatch' &&
        Array.isArray(changedFiles) &&
        changedFiles.length > 0 &&
        changedFiles.every(knownNonvisual)
        ? 'skip'
        : 'full'
}

export function localDependencies(path, source, files) {
    const parsed = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true)
    if (parsed.parseDiagnostics.length) return null
    let unknown = false
    const dependencies = new Set()
    const resolve = (specifier) => {
        if (!specifier.startsWith('.') && !specifier.startsWith('@/')) {
            // Only this alias is configured by the trusted tsconfig. Other aliases cannot be proven external.
            if (specifier.startsWith('@') && !/^@[^/]+\/[^/]+/.test(specifier)) unknown = true
            return
        }
        const base = posix.normalize(
            specifier.startsWith('@/') ? `src/${specifier.slice(2)}` : posix.join(posix.dirname(path), specifier)
        )
        const candidates = [
            base,
            ...['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json'].map((ext) => base + ext),
            ...['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].map((ext) => `${base}/index${ext}`),
        ]
        const found = candidates.find((candidate) => files.has(candidate))
        if (!found) unknown = true
        else dependencies.add(found)
    }
    const visit = (node) => {
        if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
            if (ts.isStringLiteral(node.moduleSpecifier)) resolve(node.moduleSpecifier.text)
            else unknown = true
        }
        if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
            const expression = node.moduleReference.expression
            if (expression && ts.isStringLiteral(expression)) resolve(expression.text)
            else unknown = true
        }
        if (
            ts.isCallExpression(node) &&
            (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
                (ts.isIdentifier(node.expression) && node.expression.text === 'require'))
        ) {
            if (node.arguments.length === 1 && ts.isStringLiteralLike(node.arguments[0]))
                resolve(node.arguments[0].text)
            else unknown = true
        }
        if (
            ts.isCallExpression(node) &&
            ts.isPropertyAccessExpression(node.expression) &&
            (node.expression.expression.getText(parsed) === 'require' ||
                node.expression.getText(parsed).includes('import.meta'))
        )
            unknown = true
        if (
            ts.isNewExpression(node) &&
            node.expression.getText(parsed) === 'URL' &&
            node.arguments?.some((argument) => argument.getText(parsed).includes('import.meta'))
        )
            unknown = true
        if (ts.isMetaProperty(node) && node.keywordToken === ts.SyntaxKind.ImportKeyword) unknown = true
        if (ts.isPropertyAccessExpression(node) && node.name.text === 'require') unknown = true
        if (ts.isNewExpression(node) && ['Worker', 'SharedWorker'].includes(node.expression.getText(parsed)))
            unknown = true
        if (
            ts.isIdentifier(node) &&
            node.text === 'require' &&
            !(ts.isCallExpression(node.parent) && node.parent.expression === node)
        )
            unknown = true
        ts.forEachChild(node, visit)
    }
    visit(parsed)
    return unknown ? null : [...dependencies].sort()
}

/** Hash every local input to fixture execution, rather than only its entry files. */
export function fixtureIdentityFiles(roots, options = {}) {
    const files = options.files ?? new Set(git(['ls-files', '--cached', '-z']).split('\0').filter(Boolean))
    const read = options.read ?? ((path) => readFileSync(path, 'utf8'))
    const visited = new Set(),
        pending = [...roots],
        deadline = Date.now() + 120000
    while (pending.length) {
        const path = pending.pop()
        if (visited.has(path)) continue
        if (visited.size >= 20000 || Date.now() >= deadline)
            throw new Error('Fixture identity exceeds its bounded graph budget')
        if (!files.has(path)) throw new Error(`Fixture identity input is not a tracked local file: ${path}`)
        visited.add(path)
        if (code.test(path)) {
            const dependencies = localDependencies(path, read(path), files)
            if (!dependencies) throw new Error(`Fixture dependency identity cannot be proven: ${path}`)
            pending.push(...dependencies)
        }
    }
    return [...visited].sort()
}

export function revisionGraph(revision, catalogue, runGit, deadline) {
    const paths = runGit(['ls-tree', '-r', '--name-only', '-z', revision]).split('\0').filter(Boolean)
    if (paths.length > 20000) throw new Error('Source graph exceeds its 20,000-file budget')
    const files = new Set(paths)
    const pages = paths.filter((path) => path.startsWith('src/app/') && /\/page\.[jt]sx?$/.test(path))
    const patterns = new Map(
        pages.map((path) => [
            '/' +
                path
                    .slice('src/app/'.length)
                    .replace(/(^|\/)page\.[^.]+$/, '')
                    .split('/')
                    .filter((part) => part && !part.startsWith('('))
                    .join('/'),
            path,
        ])
    )
    const sources = (screen) => {
        const surfaceId = new URL(screen.route, 'https://screen-library.invalid').searchParams.get('s')
        const surface = surfaceId ? catalogue.find((candidate) => candidate.id === surfaceId) : undefined
        const component = screen.source ?? surface?.source
        const componentPath =
            component &&
            (component.startsWith('features/') || component.startsWith('app/')
                ? `src/${component}`
                : `src/components/${component}`)
        const pattern = screen.routePattern ?? routePatternFor(screen.route.split('?')[0], [...patterns.keys()])
        const page = patterns.get(pattern)
        const root = componentPath ?? page
        if (!root || !files.has(root)) return []
        // App Router ancestor layouts/templates participate even when a surface mounts
        // only one product component. Their imports can influence every descendant flow.
        const ancestor = page ? posix.dirname(page) : 'src/app/dev/surfaces'
        const wrappers = paths.filter(
            (path) =>
                /\/(?:layout|template|error|loading)\.[jt]sx?$/.test(path) &&
                (ancestor === posix.dirname(path) || ancestor.startsWith(posix.dirname(path) + '/'))
        )
        return [root, ...wrappers]
    }
    const screens = catalogue.map((screen) => ({ id: screen.id, flow: screen.flow, sources: sources(screen) }))
    // Read blobs in one bounded subprocess; never check out or execute the target revision.
    const modules = paths.filter((path) => code.test(path))
    const data = Buffer.from(runGit(['cat-file', '--batch'], modules.map((path) => `${revision}:${path}\n`).join('')))
    const contents = new Map()
    let offset = 0
    for (const path of modules) {
        const newline = data.indexOf(10, offset)
        if (newline < 0) throw new Error('Incomplete source graph blob response')
        const header = data.subarray(offset, newline).toString('utf8').split(' ')
        const length = Number(header[2])
        if (header[1] !== 'blob' || !Number.isSafeInteger(length) || length < 0 || newline + length + 2 > data.length)
            throw new Error('Invalid source graph blob response')
        contents.set(path, data.subarray(newline + 1, newline + length + 1).toString('utf8'))
        offset = newline + length + 2
    }
    const dependencies = {}
    const pending = screens.flatMap((screen) => screen.sources)
    while (pending.length) {
        if (Date.now() >= deadline) throw new Error('Impact graph exceeded its 120-second budget')
        const path = pending.pop()
        if (Object.hasOwn(dependencies, path)) continue
        dependencies[path] = code.test(path) ? localDependencies(path, contents.get(path), files) : []
        pending.push(...(dependencies[path] ?? []))
    }
    return { screens, dependencies }
}

export function planRevisionCapture({ event, branch, before, after, catalogue = trustedCatalogue, runGit = git }) {
    const changedFiles = changedPaths(before, after, runGit)
    const fallbackScreens = catalogue.map((screen) => ({ id: screen.id, flow: screen.flow, sources: [] }))
    const initial = planCapture({ event, branch, changedFiles, screens: fallbackScreens })
    if (!changedFiles.length || initial.mode === 'skip' || event !== 'pull_request') return initial
    // Global changes are full regardless of graph, so don't parse needless source trees.
    if (
        changedFiles.some(
            (path) => !knownNonvisual(path) && !/^src\/(?:components|features|utils|app)\/.+\.[cm]?[jt]sx?$/.test(path)
        )
    )
        return initial
    try {
        const deadline = Date.now() + 120000
        const left = revisionGraph(before, catalogue, runGit, deadline),
            right = revisionGraph(after, catalogue, runGit, deadline)
        const dependencies = {}
        for (const path of new Set([...Object.keys(left.dependencies), ...Object.keys(right.dependencies)])) {
            const a = left.dependencies[path],
                b = right.dependencies[path]
            dependencies[path] = a === null || b === null ? null : [...new Set([...(a ?? []), ...(b ?? [])])]
        }
        const screens = right.screens.map((screen, index) => ({
            ...screen,
            sources: [...new Set([...screen.sources, ...left.screens[index].sources])],
        }))
        return planCapture({ event, branch, changedFiles, screens, dependencies })
    } catch (error) {
        return { ...initial, reasons: [`Impact analysis failed; full capture required: ${error.message}`] }
    }
}
