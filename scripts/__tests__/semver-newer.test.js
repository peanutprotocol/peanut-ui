const { spawnSync } = require('child_process')
const path = require('path')

const SCRIPT_PATH = path.join(__dirname, '..', 'semver-newer.mjs')

// The script is a CI entrypoint: its contract is stdout + exit code, so run it
// the way the release workflows do instead of reaching into its internals.
function run(...args) {
    return spawnSync(process.execPath, [SCRIPT_PATH, ...args], { encoding: 'utf-8' })
}

describe('semver-newer', () => {
    it.each([
        ['1.0.54', '1.0.51', 'true'],
        ['1.0.51', '1.0.54', 'false'],
        ['1.0.54', '1.0.54', 'false'],
        ['1.1.0', '1.0.9999', 'true'],
        ['2.0.0', '1.9.9', 'true'],
        // numeric, not lexicographic: 10 > 9
        ['1.0.10', '1.0.9', 'true'],
    ])('%s above %s → %s', (candidate, baseline, expected) => {
        const result = run(candidate, baseline)

        expect(result.status).toBe(0)
        expect(result.stdout.trim()).toBe(expected)
    })

    // The case sort -V gets backwards, and the reason this script exists: a
    // prerelease sorts BELOW its plain version, so a 1.0.54 binary refuses a
    // 1.0.54-hotfix1 bundle (disable_auto_update_under_native).
    it.each([
        ['1.0.54', '1.0.54-hotfix1', 'true'],
        ['1.0.54-hotfix1', '1.0.54', 'false'],
        ['1.0.54-hotfix2', '1.0.54-hotfix1', 'true'],
        ['1.0.54-hotfix1.2', '1.0.54-hotfix1', 'true'],
        // numeric prerelease identifiers compare numerically per semver §11
        ['1.0.54-2', '1.0.54-10', 'false'],
        // numeric identifiers sort below alphanumeric ones
        ['1.0.54-alpha', '1.0.54-2', 'true'],
    ])('%s above %s → %s (prerelease ordering)', (candidate, baseline, expected) => {
        const result = run(candidate, baseline)

        expect(result.status).toBe(0)
        expect(result.stdout.trim()).toBe(expected)
    })

    it.each([['not-a-version', '1.0.54'], ['1.0.54', ''], ['1.0.54'], ['1.0', '1.0.54']])(
        'fails loudly on unusable input %p %p',
        (...args) => {
            const result = run(...args.filter((a) => a !== undefined))

            expect(result.status).toBe(1)
            expect(result.stdout).toBe('')
            expect(result.stderr).toContain('semver-newer')
        }
    )
})
