import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { createHostedCollection, createLocalCollection } from './collection-cli.mjs'

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
            join(reportDir, 'capture.json'),
            JSON.stringify({
                schema: 1,
                type: 'capture',
                locale: 'en',
                commit: 'a'.repeat(40),
                screens: [
                    {
                        id: 'profile',
                        name: 'Profile',
                        flow: 'Profile',
                        kind: 'route',
                        status: 'captured',
                        image,
                    },
                ],
            })
        )
        const spec = join(root, 'spec.json')
        writeFileSync(
            spec,
            JSON.stringify({
                title: 'Review',
                items: [{ id: 'profile', note: 'Flat menu' }],
            })
        )
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

        writeFileSync(join(reportDir, 'manifest.json'), readFileSync(join(reportDir, 'capture.json')))
        const explicitManifestOut = join(root, 'explicit-manifest-out')
        const explicitManifestCollection = await createLocalCollection({
            specPath: spec,
            outDir: explicitManifestOut,
            id: 'review-20260916-explicit',
            reportArgs: { en: join(reportDir, 'manifest.json') },
        })
        assert.equal(explicitManifestCollection.complete, true)
    } finally {
        rmSync(root, { recursive: true, force: true })
    }
})

test('hosted CLI authenticates through a Cloudflare Access service token', async () => {
    let request
    const result = await createHostedCollection(
        'https://screen-collections.peanut.me',
        { title: 'Review', items: [{ id: 'profile' }] },
        {
            env: {
                CLOUDFLARE_ACCESS_CLIENT_ID: 'client-id',
                CLOUDFLARE_ACCESS_CLIENT_SECRET: 'client-secret',
            },
            fetchImpl: async (url, options) => {
                request = { url: String(url), options }
                return Response.json({ url: 'https://screens.peanut.me/collections/review' }, { status: 201 })
            },
        }
    )
    assert.equal(result.url.endsWith('/review'), true)
    assert.equal(request.options.headers['CF-Access-Client-Id'], 'client-id')
    assert.equal(request.options.headers['CF-Access-Client-Secret'], 'client-secret')
    assert.equal(request.options.headers.Authorization, undefined)
})

test('hosted CLI refuses to send the private Worker service token', async () => {
    await assert.rejects(
        () =>
            createHostedCollection(
                'https://screen-collections.peanut.me',
                { title: 'Review', items: [{ id: 'profile' }] },
                {
                    env: { COLLECTION_SERVICE_TOKEN: 'private-only' },
                    fetchImpl: async () => Response.json({}),
                }
            ),
        /CLOUDFLARE_ACCESS_CLIENT_ID and CLOUDFLARE_ACCESS_CLIENT_SECRET are required/
    )
})
