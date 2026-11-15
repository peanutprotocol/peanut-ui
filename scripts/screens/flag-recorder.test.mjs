import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { FLAG_READERS, FLAG_RECORDER_MARKER, installFlagRecorder, patchFlagReader } from './flag-recorder.mjs'
import { prepare } from './prepare.mjs'

test('all flag readers in the app carry the anchor the capture patch needs', () => {
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

test('capture-only welcome overrides render every arm without exposing ineligible users', () => {
    const reader = FLAG_READERS.find(({ path }) => path.endsWith('/welcomeHeadlineExperiment.ts'))
    const source = readFileSync(reader.path, 'utf8')
    const { outputText } = ts.transpileModule(patchFlagReader(reader, source), {
        compilerOptions: { module: ts.ModuleKind.CommonJS },
    })
    let exposures = 0
    const context = {
        exports: {},
        require: (name) => {
            if (name === 'posthog-js') return { default: { getFeatureFlag: () => exposures++ } }
            if (name === '@/utils/featureFlag.utils') return { areFeatureFlagsLoaded: () => false }
            throw new Error(`Unexpected import: ${name}`)
        },
    }
    runInNewContext(outputText, context)
    assert.equal(context.exports.readWelcomeHeadlineVariant(false), 'control')
    for (const arm of ['control', 'every_border', 'whole_world', 'travels_free']) {
        context.__screenCaptureFlag = (key, value) => {
            assert.equal(key, 'welcome-headline-copy')
            assert.equal(value, 'control')
            return arm
        }
        assert.equal(context.exports.readWelcomeHeadlineVariant(false), arm)
    }
    assert.equal(exposures, 0)
})
