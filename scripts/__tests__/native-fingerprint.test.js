const { spawnSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const SCRIPT_PATH = path.join(__dirname, '..', 'native-fingerprint.mjs')
const repoRoot = path.join(__dirname, '..', '..')

// The script is a CI entrypoint: its contract is stdout + exit code, so run it
// the way capgo-deploy.yml does instead of reaching into its internals. (Jest
// runs CJS here, so a dynamic import of the .mjs would not load anyway — same
// reason semver-newer.test.js and release-version.test.js spawn it.)
function run(...args) {
    return spawnSync(process.execPath, [SCRIPT_PATH, ...args], { encoding: 'utf-8', cwd: repoRoot })
}

function fingerprint(...args) {
    const result = run(...args)
    expect(result.status).toBe(0)
    return result.stdout.trim()
}

// Mutate one native input, read the fingerprint, always put the file back.
function withPatchedInput(relativePath, patch, assertion) {
    const target = path.join(repoRoot, relativePath)
    const original = fs.readFileSync(target, 'utf8')
    try {
        fs.writeFileSync(target, patch(original))
        assertion()
    } finally {
        fs.writeFileSync(target, original)
    }
}

describe('native-fingerprint', () => {
    it('is a stable 16-hex digest across repeated runs of one tree', () => {
        const first = fingerprint()

        expect(first).toMatch(/^[0-9a-f]{16}$/)
        expect(fingerprint()).toBe(first)
    })

    it('covers every native input, hashing it or recording its absence', () => {
        const result = run('--manifest')
        const entries = JSON.parse(result.stdout)

        expect(result.status).toBe(0)
        // toContain on the key list, not toHaveProperty: these keys contain
        // dots, which toHaveProperty would read as a nested property path.
        const keys = Object.keys(entries)
        // The two generated plugin manifests are the load-bearing inputs: they
        // pin the plugin set AND their resolved versions.
        expect(keys).toContain('android/capacitor.settings.gradle')
        expect(keys).toContain('ios/App/CapApp-SPM/Package.swift')
        expect(keys).toContain('capacitor.config.ts')
        expect(keys.length).toBeGreaterThanOrEqual(10)

        // Nothing is silently skipped — absence is its own sentinel, so adding
        // or deleting a file moves the fingerprint.
        for (const value of Object.values(entries)) {
            expect(value === '<absent>' || /^[0-9a-f]{64}$/.test(value)).toBe(true)
        }
    })

    it('reads a git ref, and differs from the working tree once native code has moved', () => {
        // v1.1.0 predates the 8.51.14 updater bump and the iOS 16.4 floor.
        expect(fingerprint('--ref', 'v1.1.0')).toMatch(/^[0-9a-f]{16}$/)
        expect(fingerprint('--ref', 'v1.1.0')).not.toBe(fingerprint())
    })

    it('exits 0 and says so when the surface has not moved', () => {
        const result = run('--diff', 'HEAD')

        expect(result.status).toBe(0)
        expect(result.stdout).toContain('native surface unchanged')
    })

    it('exits 1 naming the culprit when the surface moved', () => {
        const result = run('--diff', 'v1.1.0')

        expect(result.status).toBe(1)
        expect(result.stdout).toContain('native surface changed since v1.1.0')
        // The point of the check is that it says WHAT moved, not just that
        // something did — a bare "refused" is unactionable at 2am.
        expect(result.stdout).toContain('android/capacitor.settings.gradle')
    })

    it('moves when a plugin version changes', () => {
        const before = fingerprint()

        withPatchedInput(
            'android/capacitor.settings.gradle',
            // The shape of a real plugin bump: the resolved version lives in the
            // dependency path Capacitor generates.
            (content) => content.replace('capacitor-updater@8.51.14', 'capacitor-updater@9.0.0'),
            () => expect(fingerprint()).not.toBe(before)
        )
    })

    it('ignores the MARKETING_VERSION stamp, which is the release number not the surface', () => {
        const before = fingerprint()

        withPatchedInput(
            'ios/App/App.xcodeproj/project.pbxproj',
            // Exactly what scripts/native-ios-postsync.js writes on every cap
            // sync. Left un-normalised this would refuse an OTA after every
            // release, and the check would be turned off within a week.
            (content) => content.replace(/MARKETING_VERSION = [^;]*;/g, 'MARKETING_VERSION = 9.9.9;'),
            () => expect(fingerprint()).toBe(before)
        )
    })

    it('still notices a real pbxproj change, e.g. the deployment floor', () => {
        const before = fingerprint()

        withPatchedInput(
            'ios/App/App.xcodeproj/project.pbxproj',
            (content) => content.replace(/IPHONEOS_DEPLOYMENT_TARGET = [^;]*;/g, 'IPHONEOS_DEPLOYMENT_TARGET = 18.0;'),
            () => expect(fingerprint()).not.toBe(before)
        )
    })

    it('rejects --diff without a ref rather than comparing against nothing', () => {
        const result = run('--diff')

        expect(result.status).toBe(1)
        expect(result.stderr).toContain('needs a git ref')
    })
})
