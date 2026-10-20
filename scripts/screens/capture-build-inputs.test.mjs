import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { posix } from 'node:path'
import { fileURLToPath } from 'node:url'
import { knownNonvisual, planCapture } from './capture-plan.mjs'

const root = fileURLToPath(new URL('../../', import.meta.url))
const tracked = new Set(
    execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })
        .split('\0')
        .filter(Boolean)
)
const read = (path) => readFileSync(posix.join(root, path), 'utf8')
const isTest = (path) => /(?:^|\/)__tests__\/|\.(?:test|spec)\.[cm]?[jt]sx?$/.test(path)
// run-capture.mjs reaches these through `pnpm install`, `pnpm build` and `pnpm exec next start`.
const captureLifecycles = [
    'preinstall',
    'install',
    'postinstall',
    'prepare',
    'prebuild',
    'build',
    'postbuild',
    'prestart',
    'start',
    'poststart',
]

function lifecycleScripts() {
    const { scripts } = JSON.parse(read('package.json'))
    const expanded = new Set()
    const paths = new Set()
    const expand = (name) => {
        if (expanded.has(name) || typeof scripts[name] !== 'string') return
        expanded.add(name)
        for (const [, nested] of scripts[name].matchAll(/\b(?:pnpm|npm|yarn)\s+(?:run\s+)?([\w:.-]+)/g)) expand(nested)
        for (const [path] of scripts[name].matchAll(/scripts\/[\w./-]+/g)) paths.add(path)
    }
    for (const name of captureLifecycles) expand(name)
    return paths
}

function resolveTracked(candidate) {
    const base = posix.normalize(candidate)
    const file = [base, ...['.ts', '.mjs', '.js', '.cjs'].flatMap((ext) => [base + ext, `${base}/index${ext}`])].find(
        (path) => tracked.has(path)
    )
    if (file) return [file]
    return [...tracked].filter((path) => path.startsWith(`${base}/`))
}

function references(path) {
    const source = read(path)
    const found = []
    for (const [, specifier] of source.matchAll(/['"`](\.{1,2}\/[^'"`\s*${}]+)['"`]/g))
        found.push(...resolveTracked(posix.join(posix.dirname(path), specifier)))
    for (const [, specifier] of source.matchAll(/['"`](scripts\/[^'"`\s*${}]+)['"`]/g))
        found.push(...resolveTracked(specifier))
    return found
}

/** Every tracked scripts/ file the capture build can execute or read, followed transitively. */
function captureBuildInputs() {
    const inputs = new Set()
    const pending = [...lifecycleScripts(), 'scripts/screens/run-capture.mjs'].flatMap(resolveTracked)
    while (pending.length) {
        const path = pending.pop()
        if (inputs.has(path) || !path.startsWith('scripts/') || isTest(path)) continue
        inputs.add(path)
        // Helpers in their own directory read siblings through __dirname, so the directory ships as a unit.
        const unit = path.match(/^scripts\/(?!screens\/)[^/]+\//)?.[0]
        if (unit) pending.push(...[...tracked].filter((file) => file.startsWith(unit)))
        if (/\.[cm]?[jt]s$/.test(path)) pending.push(...references(path))
    }
    return inputs
}

const screens = [
    { id: 'pay-review', flow: 'Payments', sources: ['src/features/payments/Review.tsx'] },
    { id: 'pay-success', flow: 'Payments', sources: ['src/features/payments/Success.tsx'] },
    { id: 'home', flow: 'Home', sources: ['src/features/home/Home.tsx'] },
]
const dependencies = {
    'src/features/payments/Review.tsx': ['src/features/payments/format.ts'],
    'src/features/payments/Success.tsx': [],
    'src/features/payments/format.ts': [],
    'src/features/home/Home.tsx': [],
}
const plan = (changedFiles) =>
    planCapture({
        event: 'pull_request',
        branch: 'dev',
        changedFiles,
        screens: structuredClone(screens),
        dependencies: structuredClone(dependencies),
    })
const notBuildInputs = [
    'scripts/submit-stores.mjs',
    'scripts/backdoor-scan.mjs',
    'scripts/native-build.js',
    'scripts/play_vitals_report.py',
    'scripts/screen-wordiness-baseline.json',
    'android/app/build.gradle',
    'ios/App/App/Info.plist',
    '.codex/quality-gates.json',
]

test('derivation finds the lifecycle scripts and the harness font mock', () => {
    assert.ok(lifecycleScripts().size > 0)
    const inputs = captureBuildInputs()
    for (const path of lifecycleScripts()) assert.ok(inputs.has(path), path)
    assert.ok(inputs.has('scripts/screens/capture.ts'))
    assert.ok(inputs.has('scripts/next-font-google/mock.cjs'))
    assert.ok(inputs.has('scripts/next-font-google/manifest.json'))
})

test('every script the capture build executes or reads stays visual', () => {
    for (const path of captureBuildInputs()) {
        assert.equal(knownNonvisual(path), false, path)
        assert.equal(plan([path]).mode, 'full', path)
    }
})

test('release, tooling and native-shell changes skip capture', () => {
    const inputs = captureBuildInputs()
    for (const path of notBuildInputs) {
        assert.equal(inputs.has(path), false, path)
        assert.equal(knownNonvisual(path), true, path)
        assert.equal(plan([path]).mode, 'skip', path)
    }
    assert.equal(plan(notBuildInputs).mode, 'skip')
})

test('a nonvisual script beside an app change keeps the targeted scope', () => {
    const scoped = plan(['src/features/payments/format.ts', 'scripts/submit-stores.mjs'])
    assert.equal(scoped.mode, 'targeted')
    assert.deepEqual(scoped.screenIds, ['pay-review', 'pay-success'])
})
