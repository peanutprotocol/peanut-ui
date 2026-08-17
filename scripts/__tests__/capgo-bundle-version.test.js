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

// CI checks this repo out shallow, so the commit-count cases get their own
// repo with a known history instead of asserting against the checkout.
function makeRepo(version, commits) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'capgo-version-'))
    fs.mkdirSync(path.join(dir, 'scripts'))
    fs.copyFileSync(SCRIPT_PATH, path.join(dir, 'scripts', 'capgo-bundle-version.mjs'))
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ version }))
    const git = (...args) => execFileSync('git', args, { cwd: dir, stdio: 'ignore' })
    git('init', '-q')
    for (let i = 0; i < commits; i++) {
        git('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', `c${i}`)
    }
    return dir
}

function runIn(dir, env) {
    return run({ cwd: dir, script: path.join(dir, 'scripts', 'capgo-bundle-version.mjs'), env })
}

describe('capgo bundle version', () => {
    const nativeVersion = require(path.join(REPO_ROOT, 'package.json')).version
    const repos = []

    afterAll(() => repos.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true })))

    function repo(version, commits) {
        const dir = makeRepo(version, commits)
        repos.push(dir)
        return dir
    }

    it('derives <major>.<minor>.<commit-count> from package.json', () => {
        const result = runIn(repo('2.3.1', 12))

        expect(result.status).toBe(0)
        expect(result.stdout.trim()).toBe('2.3.12')
    })

    // The whole point of the derived version: Capgo drops bundles that sort
    // below the installed native version, and no-ops on a version it already has.
    it('fails on a shallow clone instead of shipping a version under the native one', () => {
        const result = runIn(repo('1.0.8', 1))

        expect(result.status).toBe(1)
        expect(result.stderr).toContain('fetch-depth: 0')
    })

    it('honours CAPGO_BUNDLE_VERSION', () => {
        const result = run({ env: { CAPGO_BUNDLE_VERSION: '9.9.9' } })

        expect(result.status).toBe(0)
        expect(result.stdout.trim()).toBe('9.9.9')
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
})
