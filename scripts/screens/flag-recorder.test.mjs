import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { runInNewContext } from 'node:vm'
import { FLAG_READERS, FLAG_RECORDER_MARKER, installFlagRecorder, patchFlagReader } from './flag-recorder.mjs'
import { prepare } from './prepare.mjs'

test('both flag readers in the app carry the anchor the capture patch needs', () => {
    for (const reader of FLAG_READERS) {
        const source = readFileSync(reader.path, 'utf8')
        const patched = patchFlagReader(reader, source)
        assert.notEqual(patched, source, reader.path)
        assert.ok(patched.includes(FLAG_RECORDER_MARKER))
        assert.equal(patchFlagReader(reader, patched), patched, 'patching twice changes nothing')
    }
})

test('a revision without the anchor keeps its source', () => {
    for (const reader of FLAG_READERS) assert.equal(patchFlagReader(reader, 'export const x = 1'), 'export const x = 1')
})

test('prepare patches the flag readers of a capture build', () => {
    const dir = mkdtempSync(join(tmpdir(), 'screen-flags-'))
    try {
        mkdirSync(join(dir, 'src/utils'), { recursive: true })
        writeFileSync(
            join(dir, 'src/utils/api-fetch.ts'),
            'async function callApi(path: string): Promise<Response> {return fetch(path)}'
        )
        for (const reader of FLAG_READERS) {
            mkdirSync(join(dir, dirname(reader.path)), { recursive: true })
            writeFileSync(join(dir, reader.path), readFileSync(reader.path, 'utf8'))
        }
        const changed = prepare(dir).map((entry) => entry.path)
        for (const reader of FLAG_READERS) {
            assert.ok(changed.includes(reader.path), reader.path)
            assert.ok(readFileSync(join(dir, reader.path), 'utf8').includes(FLAG_RECORDER_MARKER))
        }
    } finally {
        rmSync(dir, { recursive: true, force: true })
    }
})

test('the page hook records the first value each flag read and answers with the override', () => {
    const window = {}
    runInNewContext(`(${installFlagRecorder})(${JSON.stringify({ 'card-promotion-disabled': true })})`, { window })
    const answers = [
        window.__screenCaptureFlag('card-promotion-disabled', false),
        window.__screenCaptureFlag('user-interviews-invite', true),
        window.__screenCaptureFlag('signup-notification-switches', 'control'),
        window.__screenCaptureFlag('card-promotion-disabled', false),
    ]
    assert.deepEqual(answers, [true, true, 'control', true])
    assert.deepEqual(JSON.parse(JSON.stringify(window.__screenCaptureFlagReads)), {
        'card-promotion-disabled': false,
        'user-interviews-invite': true,
        'signup-notification-switches': 'control',
    })
})
