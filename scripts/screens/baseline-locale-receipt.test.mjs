import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { verifyReusedBaseline } from './verify-reused-baseline.mjs'

const before = 'a'.repeat(40)
const after = 'b'.repeat(40)
const repository = 'peanutprotocol/peanut-ui'
const locales = ['en', 'es-419', 'es-AR', 'pt-BR']
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex')

function fixture(locale) {
    const capture = {
        schema: 1,
        type: 'capture',
        commit: before,
        contentCommit: 'c'.repeat(40),
        harness: 'd'.repeat(64),
        fixtures: 'e'.repeat(64),
        environment: 'test',
        adapter: 'v1',
        capturedAt: '2026-10-14T00:00:00Z',
        publicBase: 'https://staging.peanut.me',
        locale,
        profile: `${locale}-393x852`,
        width: 393,
        height: 852,
        screens: ['pay', 'home'].map((id) => ({
            id,
            name: id,
            flow: id,
            kind: 'route',
            status: 'captured',
            image: 'f'.repeat(64) + '.png',
            thumbnail: 'f'.repeat(64) + '.png',
        })),
        inventory: [
            { route: '/pay', status: 'catalogued', screens: ['pay'] },
            { route: '/home', status: 'catalogued', screens: ['home'] },
        ],
    }
    const bytes = Buffer.from(JSON.stringify(capture))
    const artifact = `screen-library-after-${locale}-1`
    const run = {
        id: 12,
        path: '.github/workflows/screen-library.yml',
        event: 'push',
        head_branch: 'main',
        head_sha: before,
        head_repository: { full_name: repository },
        status: 'completed',
        conclusion: 'failure',
    }
    let downloads = 0
    const input = {
        receipt: { schema: 1, runId: '12', artifact, manifestDigest: digest(bytes), commit: before, locale },
        beforeBytes: bytes,
        after: { ...capture, commit: after },
        expectedCommit: before,
        repository,
        api(path) {
            if (!path) return { default_branch: 'main' }
            if (path === 'actions/runs/12') return run
            if (path.startsWith('actions/runs/12/artifacts')) return { artifacts: [{ name: artifact, expired: false }] }
            if (path.startsWith('actions/runs/12/jobs'))
                return {
                    jobs: locales.map((name) => ({
                        name: `capture_after (${name})`,
                        status: 'completed',
                        conclusion: 'success',
                    })),
                }
            throw new Error(`Unexpected provider fixture: ${path}`)
        },
        download(id, name, destination) {
            downloads++
            assert.equal(String(id), '12')
            assert.equal(name, artifact)
            writeFileSync(join(destination, 'capture.json'), bytes)
        },
    }
    return {
        input,
        bytes,
        run,
        get downloads() {
            return downloads
        },
    }
}

for (const locale of locales) {
    test(`trusted receipt accepts exact official locale ${locale}`, () => {
        const f = fixture(locale)
        verifyReusedBaseline(f.input)
        assert.equal(f.downloads, 1)
    })
}

test('receipt rejects unsafe artifact names before download', () => {
    for (const artifact of [
        '../screen-library-after-en-1',
        'screen-library-after-en-1/../../x',
        'screen-library-after-en-1\\x',
        'screen-library-after-en-1;touch x',
        'screen-library-after-en-1\nother',
    ]) {
        const f = fixture('en')
        assert.throws(() => verifyReusedBaseline({ ...f.input, receipt: { ...f.input.receipt, artifact } }), artifact)
        assert.equal(f.downloads, 0, artifact)
    }
})

test('receipt rejects changed locale, commit, digest, source run, and untrusted artifact', () => {
    for (const mutate of [
        (i) => ({ ...i, receipt: { ...i.receipt, locale: 'es-AR' } }),
        (i) => ({ ...i, receipt: { ...i.receipt, commit: after } }),
        (i) => ({ ...i, receipt: { ...i.receipt, manifestDigest: '0'.repeat(64) } }),
        (i) => ({ ...i, receipt: { ...i.receipt, runId: '13' } }),
        (i) => ({ ...i, receipt: { ...i.receipt, artifact: 'screen-library-after-en-2' } }),
    ]) {
        const f = fixture('en')
        assert.throws(() => verifyReusedBaseline(mutate(f.input)))
    }
})

test('matching forged local bytes and digest cannot replace trusted downloaded bytes', () => {
    const f = fixture('en')
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(f.bytes), capturedAt: '2026-10-15T00:00:00Z' }))
    assert.throws(() =>
        verifyReusedBaseline({
            ...f.input,
            beforeBytes: forged,
            receipt: { ...f.input.receipt, manifestDigest: digest(forged) },
        })
    )
    assert.equal(f.downloads, 1)
})
