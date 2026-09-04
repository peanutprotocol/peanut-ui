const { spawnSync } = require('child_process')
const path = require('path')

const SCRIPT_PATH = path.join(__dirname, '..', 'android-version-code.mjs')

// The script is a CI entrypoint: its contract is stdout + exit code, so run it
// the way android-release.yml does instead of reaching into its internals.
function run(...args) {
    return spawnSync(process.execPath, [SCRIPT_PATH, ...args], { encoding: 'utf-8' })
}

function codeAt(iso) {
    const result = run('--now', iso)
    expect(result.status).toBe(0)
    return Number(result.stdout.trim())
}

describe('android-version-code', () => {
    it('clears every legacy code Play has already seen', () => {
        // Small console codes, git-commit-count builds to ~8600, and the
        // run_number era up to the live 10048.
        expect(codeAt('2026-09-04T12:00:00Z')).toBeGreaterThan(10048)
    })

    it('stays under Play maximum', () => {
        expect(codeAt('2090-01-01T00:00:00Z')).toBeLessThanOrEqual(2100000000)
    })

    it('increases with upload time, whatever order the runs were dispatched in', () => {
        // The exact sequence that wedged the previous scheme: dispatch 1
        // uploads, dispatch 2 uploads later, then "Re-run failed jobs" is
        // pressed on dispatch 1. GitHub preserves run_number for that re-run
        // and only bumps run_attempt, so a run-numbered code went BACKWARDS and
        // Play refused the recovery upload. Wall-clock cannot: the re-run
        // uploads last, so it is highest.
        const dispatchOne = codeAt('2026-09-04T10:00:00Z')
        const dispatchTwo = codeAt('2026-09-04T11:00:00Z')
        const rerunOfDispatchOne = codeAt('2026-09-04T12:00:00Z')

        expect(dispatchTwo).toBeGreaterThan(dispatchOne)
        expect(rerunOfDispatchOne).toBeGreaterThan(dispatchTwo)
    })

    it('separates two uploads a second apart', () => {
        // A real build is 10+ minutes and the release workflow holds a mutex,
        // so this is headroom rather than a scenario — but per-second means no
        // pair of uploads can ever collide.
        expect(codeAt('2026-09-04T12:00:01Z')).toBe(codeAt('2026-09-04T12:00:00Z') + 1)
    })

    it('does not depend on the version, which is what could not stay ordered', () => {
        // Deliberate: a <major>.<build>-derived code cannot be made monotonic
        // across an out-of-order re-run. versionName carries the human version;
        // versionCode is an opaque ordering key.
        expect(run('--now', '2026-09-04T12:00:00Z').stdout.trim()).toBe(
            run('--now', '2026-09-04T12:00:00Z').stdout.trim()
        )
    })

    it('refuses a clock before the epoch rather than emitting a rejected code', () => {
        const result = run('--now', '2025-01-01T00:00:00Z')

        expect(result.status).toBe(1)
        expect(result.stderr).toContain('legacy floor')
    })

    it('refuses an unparseable date instead of defaulting to now', () => {
        const result = run('--now', 'not-a-date')

        expect(result.status).toBe(1)
        expect(result.stderr).toContain('is not a date')
    })

    it('rejects --now with no value rather than silently using the current time', () => {
        const result = run('--now')

        expect(result.status).toBe(1)
        expect(result.stderr).toContain('needs a date')
    })
})
