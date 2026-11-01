import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { captureFixtures } from './capture-fixtures.mjs'
import { captureExitCode } from './capture-status.mjs'

function fixture() {
    const root = mkdtempSync(join(tmpdir(), 'revision-fixture-blobs-'))
    const put = (path, value) => {
        mkdirSync(dirname(join(root, path)), { recursive: true })
        writeFileSync(join(root, path), value)
    }
    const files = {
        'scripts/screens/adapter.ts': "export const ADAPTER_VERSION = 'synthetic-api-v2'",
        'src/dev/fixtures/registry.ts':
            "import type { User } from '@/utils/api-fetch'; export const FIXTURES = {home:{}}",
        'src/utils/api-fetch.ts': 'export type User = { name: string }',
        'src/utils/demo-api.ts': "export { demoRespond } from './demo-kyc'",
        'src/utils/demo-kyc.ts': 'export const demoRespond = () => Response.json({before:true})',
        'src/constants/residence.consts.ts': 'export const RESTRICTED_RESIDENCE_ISO2 = []',
        'src/types/api.openapi.json': '{}',
        'package.json': '{}',
        'pnpm-lock.yaml': 'lockfileVersion: 9.0\n',
    }
    for (const [path, value] of Object.entries(files)) put(path, value)
    const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', timeout: 10000 }).trim()
    git('init', '--quiet')
    git('add', '.')
    git(
        '-c',
        'user.name=Screen tests',
        '-c',
        'user.email=screens@example.invalid',
        '-c',
        'commit.gpgsign=false',
        'commit',
        '--quiet',
        '-m',
        'Synthetic fixture revision'
    )
    return { root, put, git }
}

test('immutable identity matches execution inputs, excludes erased types and never reads the working tree', () => {
    const { root, put, git } = fixture()
    try {
        const revision = git('rev-parse', 'HEAD')
        const original = captureFixtures(root)
        assert.deepEqual(captureFixtures(root, { revision }), original)
        assert.ok(
            !original.files.includes('src/utils/api-fetch.ts'),
            'prepare-only changes reached through erased type imports are not runtime inputs'
        )
        assert.ok(original.files.includes('src/utils/demo-kyc.ts'), 'transitive responders are runtime inputs')
        put('src/utils/api-fetch.ts', 'throw new Error("Build preparation changed an unrelated app file")')
        assert.equal(captureFixtures(root).fixtures, original.fixtures)
        put('src/utils/demo-kyc.ts', 'export const demoRespond = () => Response.json({after:true})')
        assert.notEqual(captureFixtures(root).fixtures, original.fixtures)
        assert.deepEqual(captureFixtures(root, { revision }), original)
        assert.throws(() => captureFixtures(root, { revision: '--help' }), /immutable/)
    } finally {
        rmSync(root, { recursive: true, force: true })
    }
})

test('capture classifies revision-input gaps before creating a context and keeps runtime errors failed', () => {
    const source = readFileSync(new URL('./capture.ts', import.meta.url), 'utf8')
    assert.match(source, /revisionAdapter\(source\)/)
    assert.match(source, /fixtures: api\.fixtures/)
    assert.match(source, /fixtureSource: commit/)
    const gap = source.indexOf('const unavailableReason =')
    assert.ok(gap > 0 && gap < source.indexOf('browser.newContext(contextOptions)'))
    assert.match(source.slice(gap, source.indexOf('browser.newContext(contextOptions)')), /status: 'unavailable'/)
    assert.match(source, /const response = await answer\(/)
    assert.match(source, /results.push\(\{ \.\.\.metadata, status: 'failed', reason \}\)/)
    assert.equal(captureExitCode([{ status: 'unavailable', reason: 'Revision API inputs unavailable' }]), 0)
    assert.equal(captureExitCode([{ status: 'failed', reason: 'Application error' }]), 1)
})
