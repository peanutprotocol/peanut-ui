const { execFileSync, spawnSync } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')

const REPO_ROOT = path.join(__dirname, '..', '..')
const SCRIPT_PATH = path.join(REPO_ROOT, 'scripts', 'capgo-bundle-version.mjs')

// The script is a CI entrypoint: its contract is stdout + exit code, so run it
// the way the workflow does instead of reaching into its internals.
function run({ cwd = REPO_ROOT, script = SCRIPT_PATH, env = {} } = {}) {
    return spawnSync(process.execPath, [script], {
        cwd,
        encoding: 'utf-8',
        env: { ...process.env, CAPGO_BUNDLE_VERSION: '', ...env },
    })
}

describe('capgo bundle version', () => {
    const nativeVersion = require(path.join(REPO_ROOT, 'package.json')).version

    it('derives <major>.<minor>.<commit-count> from package.json', () => {
        const commitCount = execFileSync('git', ['rev-list', '--count', 'HEAD'], {
            cwd: REPO_ROOT,
            encoding: 'utf-8',
        }).trim()
        const [major, minor] = nativeVersion.split('.')

        const result = run()

        expect(result.status).toBe(0)
        expect(result.stdout.trim()).toBe(`${major}.${minor}.${commitCount}`)
    })

    // The whole point of the derived version: Capgo drops bundles that sort
    // below the installed native version, and no-ops on a version it already has.
    it('derives a version above the native one', () => {
        const [, , patch] = nativeVersion.split('.')
        const [, , derivedPatch] = run().stdout.trim().split('.')

        expect(Number(derivedPatch)).toBeGreaterThan(Number(patch))
    })

    it('honours CAPGO_BUNDLE_VERSION', () => {
        const result = run({ env: { CAPGO_BUNDLE_VERSION: '1.2.3' } })

        expect(result.status).toBe(0)
        expect(result.stdout.trim()).toBe('1.2.3')
    })

    it('rejects an override below the native version', () => {
        const result = run({ env: { CAPGO_BUNDLE_VERSION: '0.9.0' } })

        expect(result.status).toBe(1)
        expect(result.stderr).toContain('below the native version')
    })

    it('rejects a prerelease override, which devices would refuse', () => {
        const result = run({ env: { CAPGO_BUNDLE_VERSION: `${nativeVersion}-deadbee` } })

        expect(result.status).toBe(1)
        expect(result.stderr).toContain('plain X.Y.Z semver')
    })

    it('fails on a shallow clone instead of shipping version 1.0.1', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'capgo-version-'))
        try {
            fs.mkdirSync(path.join(dir, 'scripts'))
            fs.copyFileSync(SCRIPT_PATH, path.join(dir, 'scripts', 'capgo-bundle-version.mjs'))
            fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ version: nativeVersion }))
            const git = (...args) => execFileSync('git', args, { cwd: dir, stdio: 'ignore' })
            git('init', '-q')
            git('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', 'one')

            const result = run({ cwd: dir, script: path.join(dir, 'scripts', 'capgo-bundle-version.mjs') })

            expect(result.status).toBe(1)
            expect(result.stderr).toContain('fetch-depth: 0')
        } finally {
            fs.rmSync(dir, { recursive: true, force: true })
        }
    })
})
