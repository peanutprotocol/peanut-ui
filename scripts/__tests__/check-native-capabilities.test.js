/** @jest-environment node */
const assert = require('node:assert/strict')
const { execFileSync, spawnSync } = require('node:child_process')
const { mkdtempSync, rmSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join } = require('node:path')

const cwd = mkdtempSync(join(tmpdir(), 'native-capabilities-'))
const git = (...args) =>
    execFileSync('git', ['-c', 'tag.gpgSign=false', '-c', 'commit.gpgSign=false', ...args], { cwd, stdio: 'pipe' })
const script = join(__dirname, '..', 'check-native-capabilities.mjs')
const check = (tag) => spawnSync(process.execPath, [script, tag], { cwd, encoding: 'utf8' }).status
const attestation = 'peanut-native-capabilities-v1: android.pushProvisioning=compiled ios.pushProvisioning=compiled'
git('init')
git('-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '--allow-empty', '-m', attestation)
afterAll(() => rmSync(cwd, { recursive: true, force: true }))

test('rejects missing tags and malformed names', () => {
    assert.notEqual(check('v1.1.0'), 0)
    assert.notEqual(check('--all'), 0)
})
test('rejects a lightweight tag even when its commit claims capabilities', () => {
    git('tag', 'v1.2.0')
    assert.notEqual(check('v1.2.0'), 0)
})
test('requires both compiled platforms in the release annotation', () => {
    git(
        '-c',
        'user.name=Test',
        '-c',
        'user.email=test@example.invalid',
        'tag',
        '-a',
        'v1.3.0',
        '-m',
        'peanut-native-capabilities-v1: android.pushProvisioning=compiled'
    )
    assert.notEqual(check('v1.3.0'), 0)
    git('-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'tag', '-a', 'v1.4.0', '-m', attestation)
    assert.equal(check('v1.4.0'), 0)
})
