import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdtempSync, rmSync, mkdirSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PNG } from 'pngjs'
import { localDependencies, planRevisionCapture, trustedCatalogue, fixtureIdentityFiles } from './capture-impact.mjs'
import { knownNonvisual, galleryMaintenanceChange, galleryIndexChange } from './capture-plan.mjs'
import { harnessIdentityFiles, fileIdentity } from './capture-identity.mjs'
import { compare, storeAsset, hash } from './core.mjs'
import { scopeCapture } from './capture-scope.mjs'
import { findBaselineSource, pages } from './baseline-source.mjs'
import { verifyReusedBaseline } from './verify-reused-baseline.mjs'
import { canReuseBaseline } from './baseline-reuse.mjs'
import { currentCaptureReview } from './check-review-current.mjs'
import { compatibleGalleryRevision } from './check-gallery-current.mjs'

const before = 'a'.repeat(40),
    after = 'b'.repeat(40),
    repository = 'peanutprotocol/peanut-ui'
const catalogue = [
    { id: 'pay', flow: 'Payments', route: '/pay' },
    { id: 'home', flow: 'Home', route: '/home' },
]
function gitFixture(left, right, changed) {
    return (args, input) => {
        if (args[0] === 'diff') return changed.join('\0') + '\0'
        const revision = args[0] === 'ls-tree' ? args[4] : input.slice(0, 40)
        const files = revision === before ? left : right
        if (args[0] === 'ls-tree') return Object.keys(files).join('\0') + '\0'
        if (args[0] === 'cat-file')
            return input
                .trim()
                .split('\n')
                .map((line) => {
                    const text = files[line.slice(41)]
                    return `${'f'.repeat(40)} blob ${Buffer.byteLength(text)}\n${text}\n`
                })
                .join('')
        throw new Error('Unexpected git fixture command')
    }
}
const project = {
    'src/app/pay/page.tsx': 'import Review from "@/features/pay/Review"; export default Review',
    'src/app/home/page.tsx': 'export default function Home(){return null}',
    'src/features/pay/Review.tsx': 'import {format} from "./format"; export default function Review(){return format()}',
    'src/features/pay/format.ts': 'export const format=()=>"old"',
}
const plan = (left, right, changed, screens = catalogue) =>
    planRevisionCapture({
        event: 'pull_request',
        branch: 'dev',
        before,
        after,
        catalogue: screens,
        runGit: gitFixture(left, right, changed),
    })

test('conventional tests under capture and fixture directories skip before installs', () => {
    for (const path of ['scripts/screens/capture.test.mjs', 'src/dev/fixtures/__tests__/registry.test.tsx'])
        assert.equal(knownNonvisual(path), true)
    for (const path of ['scripts/screens/capture.ts', 'src/dev/fixtures/registry.ts'])
        assert.equal(knownNonvisual(path), false)
})

test('harness identity ignores generated dependencies while binding tracked source bytes', () => {
    const directory = mkdtempSync(join(tmpdir(), 'screen-harness-identity-'))
    try {
        const tracked = ['scripts/screens/capture.ts', 'pnpm-lock.yaml', 'scripts/screens/capture.test.mjs']
        mkdirSync(join(directory, 'scripts/screens/publisher/node_modules'), { recursive: true })
        for (const path of tracked) writeFileSync(join(directory, path), 'original')
        const digest = () =>
            hash(
                harnessIdentityFiles(tracked)
                    .map((path) => path + readFileSync(join(directory, path)))
                    .join('\0')
            )
        const original = digest()
        writeFileSync(
            join(directory, 'scripts/screens/publisher/node_modules/package.js'),
            'generated verifier dependency'
        )
        assert.equal(digest(), original)
        assert.deepEqual(
            harnessIdentityFiles([...tracked, 'scripts/screens/publisher/node_modules/package.js']),
            harnessIdentityFiles(tracked)
        )
        writeFileSync(join(directory, 'scripts/screens/capture.ts'), 'changed tracked harness')
        assert.notEqual(digest(), original)
        assert.ok(
            harnessIdentityFiles(['scripts/next-font-google/mock.cjs']).includes('scripts/next-font-google/mock.cjs')
        )
        assert.deepEqual(tracked, ['scripts/screens/capture.ts', 'pnpm-lock.yaml', 'scripts/screens/capture.test.mjs'])
    } finally {
        rmSync(directory, { recursive: true, force: true })
    }
})

test('capture identity hashes raw binary renderer bytes without lossy text conversion', () => {
    const paths = ['scripts/next-font-google/files/font.woff2']
    const left = fileIdentity(paths, () => Buffer.from([255]))
    const right = fileIdentity(paths, () => Buffer.from([254]))
    assert.notEqual(left, right)
    assert.equal(
        fileIdentity([...paths, ...paths], () => Buffer.from([255])),
        left
    )
    assert.deepEqual(paths, ['scripts/next-font-google/files/font.woff2'])
})

test('binary identity framing cannot move embedded path separators between files', () => {
    const a = 'scripts/next-font-google/a.woff',
        b = 'scripts/next-font-google/b.woff'
    const first = new Map([
        [a, Buffer.from(`X\0${b}\0Y`)],
        [b, Buffer.from('Z')],
    ])
    const second = new Map([
        [a, Buffer.from('X')],
        [b, Buffer.from(`Y\0${b}\0Z`)],
    ])
    assert.notDeepEqual(first.get(a), second.get(a))
    assert.notDeepEqual(first.get(b), second.get(b))
    assert.notEqual(
        fileIdentity([a, b], (path) => first.get(path)),
        fileIdentity([a, b], (path) => second.get(path))
    )
})

test('AST graph follows transitive aliases and both sides of a removed dependency', () => {
    const right = { ...project, 'src/features/pay/Review.tsx': 'export default function Review(){return null}' }
    delete right['src/features/pay/format.ts']
    const result = plan(project, right, ['src/features/pay/format.ts'])
    assert.equal(result.mode, 'targeted')
    assert.deepEqual(result.screenIds, ['pay'])
})

test('fixture identity includes transitive local policy/avatar inputs and rejects unknown loaders', () => {
    const contents = {
        'src/dev/fixtures/registry.ts': 'import {policy} from "@/features/pay/__fixtures__/policy"; export {policy}',
        'src/features/pay/__fixtures__/policy.ts':
            'import {avatar} from "@/components/Avatar/avatar.consts"; export const policy=avatar',
        'src/components/Avatar/avatar.consts.ts': 'export const avatar="old"',
    }
    const options = { files: new Set(Object.keys(contents)), read: (path) => contents[path] }
    const roots = ['src/dev/fixtures/registry.ts']
    const inputs = fixtureIdentityFiles(roots, options)
    assert.deepEqual(inputs, Object.keys(contents).sort())
    const originalIdentity = hash(inputs.map((path) => path + contents[path]).join('\n'))
    contents['src/components/Avatar/avatar.consts.ts'] = 'export const avatar="changed"'
    assert.notEqual(
        hash(
            fixtureIdentityFiles(roots, options)
                .map((path) => path + contents[path])
                .join('\n')
        ),
        originalIdentity
    )
    contents['src/features/pay/__fixtures__/policy.ts'] = 'const source="./policy"; import(source)'
    assert.throws(() => fixtureIdentityFiles(roots, options), /Fixture dependency identity cannot be proven/)
    const actual = fixtureIdentityFiles(['src/dev/fixtures/registry.ts'])
    assert.ok(actual.includes('src/features/deposit-accounts/__fixtures__/railPolicy.ts'))
    assert.ok(actual.includes('src/components/Avatar/avatar.consts.ts'))
})

test('ancestor layout influence cannot be scoped to one static page consumer', () => {
    const files = {
        ...project,
        'src/app/layout.tsx': 'import {format} from "@/features/pay/format"; export default format',
    }
    assert.equal(plan(files, files, ['src/features/pay/format.ts']).mode, 'full')
})

test('feature and app surface roots resolve against src instead of components', () => {
    for (const source of ['features/pay/Review.tsx', 'app/not-found.tsx']) {
        const files = { ...project, 'src/app/not-found.tsx': 'export default function Missing(){return null}' }
        const result = plan(
            files,
            files,
            [`src/${source}`],
            [{ id: 'pay', flow: 'Payments', route: '/dev/surfaces?s=pay', source }, catalogue[1]]
        )
        assert.equal(result.mode, 'targeted', source)
        assert.deepEqual(result.screenIds, ['pay'])
    }
})

test('unrecognized, computed or unresolved loading becomes visible full fallback', () => {
    const paths = new Set(['src/a.ts', 'src/b.ts'])
    assert.deepEqual(localDependencies('src/a.ts', 'export {value} from "./b"; import("./b")', paths), ['src/b.ts'])
    for (const source of [
        'import(path)',
        'require(path)',
        'require.resolve("./b")',
        'import.meta.glob("./*.ts")',
        'new URL("./b.ts", import.meta.url)',
        'import "./missing"',
    ])
        assert.equal(localDependencies('src/a.ts', source, paths), null, source)
    const files = { ...project, 'src/app/home/page.tsx': 'import(path)' }
    const result = plan(files, files, ['src/features/pay/format.ts'])
    assert.equal(result.mode, 'full')
    assert.match(result.reasons.join(' '), /Unknown dependency influence/)
})

test('graph provider failure cannot become a safe skip or selected pass', () => {
    const runGit = (args) => {
        if (args[0] === 'diff') return 'src/features/pay/format.ts\0'
        throw new Error('provider unavailable')
    }
    const result = planRevisionCapture({ event: 'pull_request', branch: 'dev', before, after, catalogue, runGit })
    assert.equal(result.mode, 'full')
    assert.match(result.reasons.join(' '), /provider unavailable/)
})

test('trusted generated catalogue matches current actual registered capture metadata', () => {
    const source = execFileSync(
        process.execPath,
        [
            '--import',
            'tsx',
            '--input-type=module',
            '-e',
            'import c from "./src/dev/screens/catalogue.ts"; console.log(JSON.stringify(c.SCREENS.map(({id,flow,route,routePattern,source})=>({id,flow,route,...(routePattern?{routePattern}:{}),...(source?{source}:{})}))))',
        ],
        {
            encoding: 'utf8',
            timeout: 30000,
            maxBuffer: 4 * 1024 * 1024,
        }
    )
    assert.deepEqual(JSON.parse(source), trustedCatalogue)
})

const locales = ['en', 'es-419', 'es-AR', 'pt-BR']
const run = {
    id: 12,
    path: '.github/workflows/screen-library.yml',
    event: 'push',
    head_branch: 'main',
    head_sha: before,
    head_repository: { full_name: repository },
    status: 'completed',
    conclusion: 'failure',
}
const artifacts = locales.map((locale) => ({ name: `screen-library-after-${locale}-1`, expired: false }))
const provider = (path) => {
    if (!path) return { default_branch: 'main' }
    if (path.startsWith('actions/runs/12/artifacts')) return { artifacts }
    if (path.startsWith('actions/runs/12/jobs'))
        return {
            jobs: locales.map((locale) => ({
                name: `capture_after (${locale})`,
                status: 'completed',
                conclusion: 'success',
            })),
        }
    if (path === 'actions/runs/12') return run
    if (path.startsWith('actions/runs?head_sha=')) return { workflow_runs: [run] }
    if (path.startsWith('actions/runs?branch=')) return { workflow_runs: [] }
    throw new Error(`Unexpected provider fixture: ${path}`)
}

test('trusted exact main and dev push captures are reusable; PR/fork sources are rejected', () => {
    for (const branch of ['main', 'dev']) {
        const api = (path) =>
            path.startsWith('actions/runs?head_sha=')
                ? { workflow_runs: [{ ...run, head_branch: branch }] }
                : provider(path)
        assert.equal(findBaselineSource({ api, repository, expectedCommit: before, log() {} }).kind, 'integration')
    }
    for (const candidate of [
        { ...run, event: 'pull_request' },
        { ...run, head_repository: { full_name: 'attacker/ui' } },
    ]) {
        const api = (path) =>
            path.startsWith('actions/runs?head_sha=') ? { workflow_runs: [candidate] } : provider(path)
        assert.equal(findBaselineSource({ api, repository, expectedCommit: before, log() {} }), null)
    }
})

test('cache absence is distinct from provider error, malformed pages, overflow and total deadline', () => {
    const api = (path) => (path.startsWith('actions/runs?head_sha=') ? { workflow_runs: [] } : provider(path))
    assert.equal(findBaselineSource({ api, repository, expectedCommit: before, log() {} }), null)
    assert.throws(
        () =>
            findBaselineSource({
                api() {
                    throw new Error('API denied')
                },
                repository,
                expectedCommit: before,
                log() {},
            }),
        /API denied/
    )
    assert.throws(() => pages(() => ({}), 'actions/runs', 'workflow_runs'), /Invalid/)
    assert.throws(
        () => pages(() => ({ workflow_runs: Array(100).fill(run) }), 'actions/runs', 'workflow_runs', 2),
        /exceeded 2 pages/
    )
    let time = 0
    assert.throws(
        () =>
            findBaselineSource({
                api(path) {
                    time = 121000
                    return provider(path)
                },
                repository,
                expectedCommit: before,
                log() {},
                now: () => time,
            }),
        /deadline; availability unknown/
    )
})

const manifest = (image) => ({
    schema: 1,
    type: 'capture',
    commit: before,
    contentCommit: 'c'.repeat(40),
    harness: 'd'.repeat(64),
    fixtures: 'e'.repeat(64),
    environment: 'test',
    adapter: 'v1',
    capturedAt: '2026-10-14T00:00:00Z',
    publicBase: 'https://staging.peanut.me',
    locale: 'en',
    profile: 'en-393x852',
    width: 393,
    height: 852,
    screens: ['pay', 'home'].map((id) => ({
        id,
        name: id,
        flow: id,
        kind: 'route',
        status: 'captured',
        image,
        thumbnail: image,
    })),
    inventory: [
        { route: '/pay', status: 'catalogued', screens: ['pay'] },
        { route: '/home', status: 'catalogued', screens: ['home'] },
    ],
})

test('baseline reuse cannot certify missing origin or empty renderer identity', () => {
    const capture = manifest('f'.repeat(64) + '.png')
    for (const change of [{ publicBase: undefined }, { environment: ' ' }, { adapter: '' }, { capturedAt: 'unknown' }])
        assert.equal(
            canReuseBaseline({ ...capture, ...change }, { ...capture, ...change, commit: after }, before),
            false
        )
})

test('scope comparison omits unrelated states without claiming removals or full completeness', () => {
    const dir = mkdtempSync(join(tmpdir(), 'screen-cost-'))
    try {
        const png = new PNG({ width: 393, height: 852 })
        png.data.fill(255)
        const image = storeAsset(dir, PNG.sync.write(png))
        const left = manifest(image),
            right = scopeCapture({ ...left, commit: after }, { mode: 'targeted', screenIds: ['pay'] })
        const result = compare(left, right, dir)
        assert.deepEqual(
            result.screens.map((screen) => [screen.id, screen.status]),
            [['pay', 'unchanged']]
        )
        assert.equal(result.complete, false)
        assert.equal(result.scopeComplete, true)
    } finally {
        rmSync(dir, { recursive: true, force: true })
    }
})

test('reuse receipt verifies real external bytes and cannot certify retagged baseline data', () => {
    const bytes = Buffer.from(JSON.stringify(manifest('f'.repeat(64) + '.png')))
    const right = { ...JSON.parse(bytes), commit: after }
    const receipt = {
        schema: 1,
        runId: '12',
        artifact: artifacts[0].name,
        manifestDigest: hash(bytes),
        commit: before,
        locale: 'en',
    }
    let downloads = 0
    const input = {
        receipt,
        beforeBytes: bytes,
        after: right,
        expectedCommit: before,
        repository,
        api: provider,
        download(id, name, destination) {
            downloads++
            writeFileSync(join(destination, 'capture.json'), bytes)
        },
    }
    verifyReusedBaseline(input)
    assert.equal(downloads, 1)
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(bytes), capturedAt: 'retagged' }))
    assert.throws(
        () =>
            verifyReusedBaseline({
                ...input,
                beforeBytes: forged,
                receipt: { ...receipt, manifestDigest: hash(forged) },
            }),
        /external source/
    )
    assert.throws(() => verifyReusedBaseline({ ...input, expectedCommit: after }), /Invalid reused baseline/)
})

test('trusted reused revision-owned bytes must match the independently expected base fixtures', () => {
    const left = { ...manifest('f'.repeat(64) + '.png'), fixtureSource: before }
    const bytes = Buffer.from(JSON.stringify(left))
    const input = {
        receipt: {
            schema: 1,
            runId: '12',
            artifact: artifacts[0].name,
            manifestDigest: hash(bytes),
            commit: before,
            locale: 'en',
        },
        beforeBytes: bytes,
        after: { ...left, commit: after, fixtureSource: after, fixtures: '9'.repeat(64) },
        expectedCommit: before,
        expectedFixtures: left.fixtures,
        repository,
        api: provider,
        download(id, name, destination) {
            writeFileSync(join(destination, 'capture.json'), bytes)
        },
    }
    assert.doesNotThrow(() => verifyReusedBaseline(input))
    for (const expectedFixtures of [undefined, input.after.fixtures])
        assert.throws(() => verifyReusedBaseline({ ...input, expectedFixtures }), /external source or environment/)
})

test('closed, superseded, moved-base and foreign PRs cannot start fresh fallback', () => {
    const pr = {
        state: 'open',
        head: { repo: { full_name: repository }, sha: after },
        base: { ref: 'dev', sha: before },
    }
    const expected = { repository, head: after, base: before }
    assert.equal(currentCaptureReview(pr, expected), true)
    for (const changed of [
        { ...pr, state: 'closed' },
        { ...pr, head: { ...pr.head, sha: before } },
        { ...pr, base: { ...pr.base, sha: after } },
        { ...pr, head: { ...pr.head, repo: { full_name: 'attacker/ui' } } },
    ])
        assert.equal(currentCaptureReview(changed, expected), false)
})

test('real baseline selector reuses valid assets and requests one fresh fallback for misses or rejected data', () => {
    const directory = mkdtempSync(join(tmpdir(), 'screen-selector-'))
    try {
        const source = join(directory, 'source'),
            afterDir = join(directory, 'after')
        mkdirSync(join(source, 'assets'), { recursive: true })
        mkdirSync(afterDir)
        const png = new PNG({ width: 393, height: 852 })
        png.data.fill(255)
        const asset = storeAsset(join(source, 'assets'), PNG.sync.write(png))
        const capture = manifest(asset)
        writeFileSync(join(source, 'capture.json'), JSON.stringify(capture))
        writeFileSync(join(afterDir, 'capture.json'), JSON.stringify({ ...capture, commit: after }))
        const jobs = locales.map((locale) => ({
            name: `capture_after (${locale})`,
            status: 'completed',
            conclusion: 'success',
        }))
        const executable = `#!/bin/sh
set -eu
if [ "$FIXTURE_MODE" = api-error ]; then exit 1; fi
if [ "$1" = run ]; then
  while [ "$1" != --dir ]; do shift; done
  mkdir -p "$2"
  cp -R "$FIXTURE_SOURCE/." "$2"
  exit 0
fi
case "$2" in
  repos/${repository}) printf '%s' '{"default_branch":"main"}' ;;
  */artifacts?*) printf '%s' '${JSON.stringify({ artifacts })}' ;;
  */jobs?*) printf '%s' '${JSON.stringify({ jobs })}' ;;
  *branch=*) printf '%s' '{"workflow_runs":[]}' ;;
  *) if [ "$FIXTURE_MODE" = missing ]; then printf '%s' '{"workflow_runs":[]}'; else printf '%s' '${JSON.stringify({ workflow_runs: [run] })}'; fi ;;
esac
`
        writeFileSync(join(directory, 'gh'), executable, { mode: 0o755 })
        for (const mode of ['valid', 'missing', 'incompatible', 'corrupt', 'api-error']) {
            writeFileSync(
                join(source, 'capture.json'),
                JSON.stringify(mode === 'incompatible' ? { ...capture, harness: '9'.repeat(64) } : capture)
            )
            if (mode === 'corrupt') writeFileSync(join(source, 'assets', asset), 'corrupt')
            const destination = join(directory, mode),
                output = join(directory, `${mode}.output`)
            const invoke = () =>
                execFileSync(
                    process.execPath,
                    [fileURLToPath(new URL('./select-before.mjs', import.meta.url)), afterDir, destination],
                    {
                        cwd: directory,
                        encoding: 'utf8',
                        timeout: 30000,
                        env: {
                            ...process.env,
                            PATH: `${directory}:${process.env.PATH}`,
                            REPOSITORY: repository,
                            BEFORE: before,
                            LOCALE: 'en',
                            GITHUB_OUTPUT: output,
                            FIXTURE_MODE: mode,
                            FIXTURE_SOURCE: source,
                        },
                        stdio: ['ignore', 'pipe', 'pipe'],
                    }
                )
            if (mode === 'api-error') {
                assert.throws(invoke)
                assert.equal(existsSync(output), false, 'API error must not become cache absence')
            } else {
                const log = invoke()
                assert.equal(readFileSync(output, 'utf8'), `reused=${mode === 'valid'}\n`)
                assert.equal(existsSync(join(destination, 'capture.json')), mode === 'valid')
                if (mode === 'valid') {
                    assert.equal(readFileSync(join(destination, 'capture.json'), 'utf8'), JSON.stringify(capture))
                    assert.equal(JSON.parse(readFileSync(join(destination, 'baseline-source.json'))).runId, '12')
                } else assert.match(log, /capture before once/)
            }
            rmSync(join(directory, 'baseline-en'), { recursive: true, force: true })
        }
    } finally {
        rmSync(directory, { recursive: true, force: true })
    }
})

test('workflow skips before installs, checks current PR, gates one fresh fallback and keeps trusted publisher', () => {
    const workflow = readFileSync(new URL('../../.github/workflows/screen-library.yml', import.meta.url), 'utf8')
    assert.match(workflow, /refs:\n[\s\S]*?runs-on: ubuntu-24.04\n\s+timeout-minutes: 5/)
    assert.ok(
        workflow.indexOf('Decide before installing capture dependencies') <
            workflow.indexOf('Install isolated impact parser')
    )
    const beforeJob = workflow.slice(workflow.indexOf('    capture_before:'))
    assert.ok(beforeJob.indexOf('Select verified exact-before capture') < beforeJob.indexOf('Install capture tools'))
    assert.ok(beforeJob.indexOf('Check current PR before fresh fallback') < beforeJob.indexOf('Install capture tools'))
    assert.equal((beforeJob.match(/node scripts\/screens\/run-capture.mjs/g) ?? []).length, 1)
    assert.match(beforeJob, /steps.current.outputs.current != 'false' && steps.reuse.outputs.reused != 'true'/)
    assert.match(workflow, /screen-library-publish.yml@dev/)
    assert.equal(
        (
            workflow.match(
                /matrix:\n\s+locale: \$\{\{ fromJSON\(needs\.refs\.outputs\.locales \|\| '\["en","es-419","es-AR","pt-BR"\]'\) \}\}/g
            ) ?? []
        ).length,
        2
    )
    assert.match(
        readFileSync(new URL('../../public/screen-library/viewer.js', import.meta.url), 'utf8'),
        /other flows were not captured/
    )
})

test('viewer/index maintenance skips app capture and preserves trusted isolated delivery', () => {
    for (const path of [
        'public/screen-library/viewer.js',
        'scripts/screens/worker/index.mjs',
        'scripts/screens/publication-index.mjs',
    ]) {
        assert.equal(knownNonvisual(path), true)
        assert.equal(galleryMaintenanceChange(path), true)
    }
    assert.equal(galleryMaintenanceChange('README.md'), false)
    assert.equal(galleryIndexChange('scripts/screens/publication-index.mjs'), true)
    assert.equal(galleryIndexChange('public/screen-library/viewer.js'), false)
    const caller = readFileSync(new URL('../../.github/workflows/screen-library.yml', import.meta.url), 'utf8')
    const publisher = readFileSync(
        new URL('../../.github/workflows/screen-library-publish.yml', import.meta.url),
        'utf8'
    )
    const gallery = readFileSync(new URL('../../.github/workflows/screen-library-gallery.yml', import.meta.url), 'utf8')
    const decision = readFileSync(new URL('./decide-capture.mjs', import.meta.url), 'utf8')
    assert.match(caller, /needs.refs.outputs.mode == 'skip' && needs.refs.outputs.gallery == 'true'/)
    const callerWorkflows = [
        ...caller.matchAll(/uses: peanutprotocol\/peanut-ui\/\.github\/workflows\/([^@\s]+)@dev/g),
    ].map((match) => match[1])
    assert.deepEqual([...new Set(callerWorkflows)], ['screen-library-publish.yml'])
    assert.equal(callerWorkflows.length, 2)
    const galleryCall = caller.slice(caller.indexOf('\n    gallery:\n'), caller.indexOf('\n    publish:\n'))
    assert.doesNotMatch(galleryCall, /\n\s+with:/)
    for (const permission of ['contents: read', 'actions: read', 'pull-requests: write'])
        assert.ok(galleryCall.includes(permission))
    assert.match(publisher, /deploy:\n\s+needs: index/)
    assert.match(publisher, /screen-library-gallery.yml@dev/)
    assert.match(publisher, /BEFORE: \$\{\{ github.event.before \}\}/)
    assert.match(publisher, /AFTER: \$\{\{ github.sha \}\}/)
    assert.match(publisher, /needs.route.result == 'skipped'/)
    assert.match(publisher, /needs.route.outputs.mode != 'skip'/)
    assert.match(
        publisher,
        /refresh_indexes: \$\{\{ needs.route.outputs.mode == 'skip' && needs.route.outputs.refresh_indexes == 'true' \}\}/
    )
    assert.match(publisher, /deploy:\n\s+needs: index[\s\S]+with:\n\s+refresh_indexes: false\n\s+deploy_gallery: true/)
    assert.match(publisher, /index:\n[\s\S]*?runs-on: ubuntu-24.04\n\s+timeout-minutes: 10/)
    assert.match(publisher, /always\(\) && !cancelled\(\)/)
    assert.match(gallery, /always\(\) && !cancelled\(\)/)
    assert.match(gallery, /environment: screen-library-deploy/)
    assert.match(gallery, /ref: \$\{\{ github.sha \}\}/)
    assert.match(gallery, /group: screen-library-index/)
    assert.match(gallery, /group: screen-library-gallery-deploy/)
    assert.match(gallery, /inputs.deploy_gallery/)
    assert.match(gallery, /fetch-depth: 0/)
    assert.match(gallery, /node scripts\/screens\/check-gallery-current.mjs/)
    assert.match(decision, /capabilities\?\.galleryMaintenance === 1/)
    assert.match(decision, /retaining legacy capture\/publication delivery/)
    assert.equal((gallery.match(/name: Deploy private gallery/g) ?? []).length, 1)
})

test('trusted push router derives viewer/index/visual delivery from exact Git paths without caller inputs', () => {
    const directory = mkdtempSync(join(tmpdir(), 'screen-trusted-route-'))
    try {
        writeFileSync(
            join(directory, 'git'),
            `#!/bin/sh
set -eu
case "$1" in
  diff) printf '%s\\0' "$FIXTURE_PATH" ;;
  show) printf '%s' '{"galleryMaintenance":1,"scopedCapture":1}' ;;
  *) exit 1 ;;
esac
`,
            { mode: 0o755 }
        )
        const cases = [
            [
                'public/screen-library/viewer.js',
                { mode: 'skip', gallery: 'true', refresh_indexes: 'false', deploy_gallery: 'true' },
            ],
            [
                'scripts/screens/publication-index.mjs',
                { mode: 'skip', gallery: 'true', refresh_indexes: 'true', deploy_gallery: 'false' },
            ],
            ['docs/design.md', { mode: 'skip', gallery: 'false', refresh_indexes: 'false', deploy_gallery: 'false' }],
            [
                'src/features/pay/Review.tsx',
                { mode: 'full', gallery: 'false', refresh_indexes: 'false', deploy_gallery: 'false' },
            ],
        ]
        // One cold Node start for four real CLI evaluations, with a 30-second
        // total fixture budget. Query suffixes evaluate each entrypoint afresh.
        const outputs = cases.map((_, index) => join(directory, `output-${index}`))
        const script = `const paths=${JSON.stringify(cases.map(([path]) => path))}; const outputs=${JSON.stringify(outputs)}; const entry=${JSON.stringify(new URL('./decide-capture.mjs', import.meta.url).href)}; for(let i=0;i<paths.length;i++){ process.env.FIXTURE_PATH=paths[i]; process.env.GITHUB_OUTPUT=outputs[i]; await import(entry+'?fixture='+i); }`
        execFileSync(process.execPath, ['--input-type=module', '-e', script], {
            cwd: directory,
            encoding: 'utf8',
            timeout: 30000,
            env: {
                ...process.env,
                PATH: `${directory}:${process.env.PATH}`,
                BEFORE: before,
                AFTER: after,
                EVENT: 'push',
                BRANCH: 'dev',
            },
        })
        for (const [index, [path, expected]] of cases.entries()) {
            const actual = Object.fromEntries(
                readFileSync(outputs[index], 'utf8')
                    .trim()
                    .split('\n')
                    .map((line) => line.split('='))
            )
            for (const [key, value] of Object.entries(expected)) assert.equal(actual[key], value, `${path}: ${key}`)
        }
    } finally {
        rmSync(directory, { recursive: true, force: true })
    }
})

test('queued viewer delivery survives newer docs-only push but cannot roll back newer viewer inputs', () => {
    assert.equal(
        compatibleGalleryRevision({ queued: before, current: after, changedFiles: ['docs/design.md', 'README.md'] }),
        true
    )
    for (const path of [
        'public/screen-library/viewer.js',
        'scripts/screens/worker/index.mjs',
        'scripts/screens/deploy/package-lock.json',
        '.github/workflows/screen-library-gallery.yml',
    ])
        assert.equal(compatibleGalleryRevision({ queued: before, current: after, changedFiles: [path] }), false, path)
    assert.equal(compatibleGalleryRevision({ queued: before, current: before, changedFiles: [] }), true)
    assert.throws(
        () => compatibleGalleryRevision({ queued: before, current: after, changedFiles: ['../README.md'] }),
        /Cannot prove/
    )
})
