/** @jest-environment node */

/*
 * The publish lane writes the per-platform floors into the bundle comment and the
 * app parses them back out of getLatest(). Two files, one format, and no runtime
 * error if they disagree — a mismatched marker just means every device silently
 * falls back to the candidate-version rule, which is the state that froze the
 * iOS population. So the contract is executed here rather than eyeballed: the
 * workflow's own shell builds the string, and the app's own regex reads it.
 */
const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const REPO_ROOT = path.join(__dirname, '..', '..')
const WORKFLOW = path.join(REPO_ROOT, '.github', 'workflows', 'release-ota.yml')
const GATE = path.join(REPO_ROOT, 'src', 'utils', 'ota-native-gate.ts')

// The assignment as the workflow writes it, not a copy of it. Read as text
// rather than parsed YAML — the suite has no yaml dependency, and the rest of
// the workflow tests here assert on the source the same way.
const workflowSource = fs.readFileSync(WORKFLOW, 'utf8')

function commentAssignment() {
    const line = workflowSource.split('\n').find((l) => l.trim().startsWith('COMMENT='))
    expect(line).toBeDefined()
    return line.trim()
}

// The regex as the app declares it, not a copy of it.
function markerRegex() {
    const source = fs.readFileSync(GATE, 'utf8')
    const declared = source.match(/const FLOOR_MARKER = \/(.+)\/\n/)
    expect(declared).not.toBeNull()
    return new RegExp(declared[1])
}

function buildComment({ android, ios, commitMsg = 'fix: something\nsecond line' }) {
    const result = spawnSync('bash', ['-c', `${commentAssignment()}; printf '%s' "$COMMENT"`], {
        env: {
            ...process.env,
            GITHUB_SHA: 'abc1234567890abcdef',
            COMMIT_MSG: commitMsg,
            FLOOR_ANDROID: android,
            FLOOR_IOS: ios,
        },
        encoding: 'utf8',
    })
    expect(result.status).toBe(0)
    return result.stdout
}

it('the comment the lane writes is the comment the app can parse', () => {
    const comment = buildComment({ android: '1.6.0', ios: '1.5.0' })
    const match = markerRegex().exec(comment)
    expect(match).not.toBeNull()
    expect([match[1], match[2]]).toEqual(['1.6.0', '1.5.0'])
})

// Only the first line of the commit message is taken, so a multi-line message
// cannot push the marker onto a line the parser never sees.
it('keeps the marker on the first line, past a multi-line commit message', () => {
    const comment = buildComment({ android: '1.7.0', ios: '1.5.0' })
    expect(comment.split('\n')).toHaveLength(1)
    expect(markerRegex().test(comment)).toBe(true)
})

// A commit subject is arbitrary text. It must not be able to forge or break the
// marker that follows it.
it.each([
    ['a version-shaped subject', 'chore: bump to 9.9.9'],
    ['a subject naming the marker', 'fix: ota-floors: android=9.9.9 ios=9.9.9 was wrong'],
    ['quotes and brackets', 'fix: handle "[ota-floors]" in $COMMENT'],
])('reads the real floors past %s', (_label, commitMsg) => {
    const comment = buildComment({ android: '1.6.0', ios: '1.5.0', commitMsg })
    const match = markerRegex().exec(comment)
    expect(match).not.toBeNull()
    // The lane appends its marker last, and the regex is end-anchored, so the
    // lane's numbers are the ones read — a subject cannot forge a floor. An
    // unanchored match read 9.9.9 here, which refuses every bundle on every
    // binary: fleet-wide OTA death by commit message.
    expect([match[1], match[2]]).toEqual(['1.6.0', '1.5.0'])
})

it('ignores a marker that is not at the end, however well-formed', () => {
    const forged = '[ota-floors: android=9.9.9 ios=9.9.9] abc1234 — a subject'
    expect(markerRegex().test(forged)).toBe(false)
})

it('the verify step checks for the same string the upload writes', () => {
    const marker = '[ota-floors: android=$FLOOR_ANDROID ios=$FLOOR_IOS]'
    expect(workflowSource).toContain('Verify the floors reached the bundle')
    expect(workflowSource).toContain(`EXPECTED="${marker}"`)
    expect(commentAssignment()).toContain(marker)
})

/*
 * --lowest is what the channel's single min_update_version is set from. A
 * refactor that leaves the resolver's unit cases green can still hand production
 * the wrong shared floor if this handoff moves.
 */
it('passes the shared floor to --min-update-version, and the per-platform ones to the export', () => {
    expect(workflowSource).toContain('NATIVE_FLOOR: ${{ steps.ota_floors.outputs.lowest }}')
    expect(workflowSource).toContain('--min-update-version "$NATIVE_FLOOR"')
    expect(workflowSource).toContain('NEXT_PUBLIC_OTA_FLOOR_ANDROID=${{ steps.ota_floors.outputs.android }}')
    expect(workflowSource).toContain('NEXT_PUBLIC_OTA_FLOOR_IOS=${{ steps.ota_floors.outputs.ios }}')
    expect(workflowSource).toContain('node scripts/ota-platform-floor.mjs --lowest')
})
