/** @jest-environment node */
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const { git } = require('./fixtures/content-publish-repo')

const SCRIPT = path.join(__dirname, '..', 'ota-bundle-digest.mjs')

function cli(cwd, ...args) {
    return spawnSync(process.execPath, [SCRIPT, ...args], { cwd, encoding: 'utf8' })
}

const tmp = []
afterAll(() => tmp.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true })))
function mkdtemp(prefix) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix))
    tmp.push(dir)
    return dir
}

// A miniature static export with the same shape as a real one: the build id in
// a folder name and the HTML, the commit and display version inlined into one
// chunk, a Sentry debug id per chunk, and content-hashed chunk names that the
// runtime and HTML name.
function exportDir({ buildId, commit, version, hashes, debugIds, pageCode = 'render(home)', image = 'PNG1' }) {
    const dir = mkdtemp('ota-export-')
    const write = (file, text) => {
        fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true })
        fs.writeFileSync(path.join(dir, file), text)
    }
    const [page, runtime, css] = hashes
    write(
        `_next/static/chunks/app/home/page-${page}.js`,
        `${pageCode};release("${commit}","${version}")\n//# debugId=${debugIds[0]}`
    )
    write(`_next/static/chunks/webpack-${runtime}.js`, `chunks={7:"${page}"}\n//# debugId=${debugIds[1]}`)
    write(`_next/static/css/${css}.css`, 'body{margin:0}')
    write(`_next/static/${buildId}/_buildManifest.js`, `self.__BUILD_MANIFEST={}`)
    write('_next/static/media/logo.1a2b3c4d.png', image)
    write(
        'index.html',
        `<link href="/_next/static/css/${css}.css"><script src="/_next/static/chunks/webpack-${runtime}.js"></script>"b":"${buildId}"`
    )
    return dir
}

const first = {
    buildId: 'buildIdAAAAAAAAAAAAAA',
    commit: 'abc1234',
    version: '1.45.1',
    hashes: ['1111111111111111', '2222222222222222', '3333333333333333'],
    debugIds: ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'],
}
// The same app built again: every volatile value and every hash it touches differ.
const rebuilt = {
    buildId: 'buildIdBBBBBBBBBBBBBB',
    commit: 'def5678',
    version: '1.45.2',
    hashes: ['4444444444444444', '5555555555555555', '3333333333333333'],
    debugIds: ['33333333-3333-4333-8333-333333333333', '44444444-4444-4444-8444-444444444444'],
}
function digest(build) {
    const result = cli(os.tmpdir(), 'digest', exportDir(build), build.buildId, build.commit, build.version)
    expect(result.status).toBe(0)
    return result.stdout.trim()
}

describe('bundle digest', () => {
    it('is the same for two builds of one app, whatever each run baked in', () => {
        expect(digest(first)).toMatch(/^sha256:[0-9a-f]{64}$/)
        expect(digest(rebuilt)).toBe(digest(first))
    })

    it('changes with any change to the app code, an asset or a baked value that is not volatile', () => {
        const base = digest(first)
        expect(digest({ ...rebuilt, pageCode: 'render(home2)' })).not.toBe(base)
        expect(digest({ ...rebuilt, image: 'PNG2' })).not.toBe(base)
        expect(digest({ ...rebuilt, pageCode: 'render(home);floor("1.44.0")' })).not.toBe(
            digest({ ...first, pageCode: 'render(home);floor("1.45.0")' })
        )
    })

    it('fails on an export it cannot read safely', () => {
        const dir = exportDir(first)
        expect(cli(dir, 'digest', dir, first.buildId, 'abcd').status).toBe(1)
        expect(cli(dir, 'digest', dir).status).toBe(1)
        expect(cli(dir, 'digest', path.join(dir, '_next'), first.buildId).status).toBe(1)
        fs.writeFileSync(path.join(dir, '_next/static/chunks/a-1111111111111111.js'), 'x')
        expect(cli(dir, 'digest', dir, first.buildId).stderr).toContain('two chunks share the hash')
    })

    it('fails when chunks name each other in a cycle', () => {
        const dir = mkdtemp('ota-export-')
        fs.writeFileSync(path.join(dir, 'index.html'), '')
        fs.writeFileSync(path.join(dir, 'a-aaaaaaaaaaaaaaaa.js'), 'load("bbbbbbbbbbbbbbbb")')
        fs.writeFileSync(path.join(dir, 'b-bbbbbbbbbbbbbbbb.js'), 'load("aaaaaaaaaaaaaaaa")')
        const result = cli(dir, 'digest', dir, 'volatile')
        expect(result.status).toBe(1)
        expect(result.stderr).toContain('do not settle')
    })
})

describe('compare with the live source commit', () => {
    const DIGEST = `sha256:${'d'.repeat(64)}`
    let repo, live
    beforeAll(() => {
        repo = mkdtemp('ota-compare-')
        git(repo, 'init', '-q', '-b', 'main')
        fs.mkdirSync(path.join(repo, 'src'))
        fs.writeFileSync(path.join(repo, 'src/app.ts'), 'v1')
        git(repo, 'add', '.')
        git(repo, 'commit', '-q', '-m', 'live')
        live = git(repo, 'rev-parse', 'HEAD')
        git(repo, 'tag', '-a', 'ota-1.44.1', '-m', 'OTA release 1.44.1', '-m', `bundle-digest: ${DIGEST}`)
        git(repo, 'tag', '-a', 'v1.45.0', '-m', 'Native release 1.45.0')
    })
    function at(files, setup = () => {}) {
        git(repo, 'checkout', '-q', '--detach', live)
        for (const [file, text] of Object.entries(files)) {
            fs.mkdirSync(path.dirname(path.join(repo, file)), { recursive: true })
            fs.writeFileSync(path.join(repo, file), text)
        }
        git(repo, 'add', '.')
        git(repo, 'commit', '-q', '--allow-empty', '-m', 'head')
        setup()
    }

    it('skips when only paths that reach the app through out/ changed and the digests match', () => {
        at({ 'src/landing.tsx': 'x', 'public/a.png': 'x', 'e2e/a.spec.ts': 'x', 'README.md': 'x' })
        const result = cli(repo, 'compare', DIGEST, live, live)
        expect(result.status).toBe(0)
        expect(result.stdout).toContain('Production already serves bundle')
    })

    it.each([
        ['native code', { 'android/app/Main.java': 'x' }],
        ['the lockfile', { 'pnpm-lock.yaml': 'x' }],
        ['a workflow', { '.github/workflows/release-ota.yml': 'x' }],
        ['a build script', { 'scripts/native-build.js': 'x' }],
        ['the Capacitor config', { 'capacitor.config.ts': 'x' }],
    ])('releases when %s changed', (_name, files) => {
        at(files)
        const result = cli(repo, 'compare', DIGEST, live)
        expect(result.status).toBe(1)
        expect(result.stdout).toContain('reach the app outside out/')
    })

    it('releases when the digest differs or any input is missing or malformed', () => {
        at({ 'src/landing.tsx': 'x' })
        expect(cli(repo, 'compare', `sha256:${'e'.repeat(64)}`, live).stdout).toContain('records sha256:ddd')
        expect(cli(repo, 'compare', '', live).status).toBe(1)
        expect(cli(repo, 'compare', DIGEST).status).toBe(1)
        expect(cli(repo, 'compare', DIGEST, 'builtin').status).toBe(1)
        expect(cli(repo, 'compare', DIGEST, 'f'.repeat(40)).status).toBe(1)
    })

    it('releases when the live commit has no store build or no digest-carrying OTA tag', () => {
        at({}, () => {
            const other = git(repo, 'rev-parse', 'HEAD')
            git(repo, 'tag', '-a', 'ota-1.45.1', '-m', 'OTA release 1.45.1', other)
            expect(cli(repo, 'compare', DIGEST, other).stdout).toContain('has no native release tag')
            git(repo, 'tag', '-a', 'v1.46.0', '-m', 'Native release 1.46.0', other)
            expect(cli(repo, 'compare', DIGEST, other).stdout).toContain('records no bundle digest')
            git(repo, 'tag', '-d', 'ota-1.45.1', 'v1.46.0')
        })
        // A main that no longer contains the live commit.
        git(repo, 'checkout', '-q', '--orphan', 'elsewhere')
        git(repo, 'commit', '-q', '--allow-empty', '-m', 'unrelated')
        expect(cli(repo, 'compare', DIGEST, live).stdout).toContain('does not contain the live source')
    })
})
