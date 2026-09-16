import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { createLocalCollection } from './collection-cli.mjs'

const webp = Buffer.from('RIFF0000WEBPscreen-library-test')

test('local CLI emits a self-contained collection viewer from selected capture assets', async () => {
    const root = mkdtempSync(join(tmpdir(), 'screen-collection-cli-'))
    try {
        const reportDir = join(root, 'capture')
        const out = join(root, 'out')
        mkdirSync(join(reportDir, 'assets'), { recursive: true })
        const image = createHash('sha256').update(webp).digest('hex') + '.webp'
        writeFileSync(join(reportDir, 'assets', image), webp)
        writeFileSync(
            join(reportDir, 'manifest.json'),
            JSON.stringify({
                schema: 1,
                type: 'capture',
                locale: 'en',
                commit: 'a'.repeat(40),
                screens: [
                    { id: 'profile', name: 'Profile', flow: 'Profile', kind: 'route', status: 'captured', image },
                ],
            })
        )
        const spec = join(root, 'spec.json')
        writeFileSync(spec, JSON.stringify({ title: 'Review', items: [{ id: 'profile', note: 'Flat menu' }] }))
        const collection = await createLocalCollection({
            specPath: spec,
            outDir: out,
            id: 'review-20260916-abc123',
            reportArgs: { en: reportDir },
        })
        assert.equal(collection.complete, true)
        assert.equal(readFileSync(join(out, 'manifest.json'), 'utf8').includes('Flat menu'), true)
        assert.equal(readFileSync(join(out, 'index.html'), 'utf8').includes('./report.js'), true)
        assert.deepEqual(readFileSync(join(out, 'assets', image)), webp)
    } finally {
        rmSync(root, { recursive: true, force: true })
    }
})
