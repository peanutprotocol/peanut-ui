import { test } from 'node:test'
import assert from 'node:assert/strict'
import { configuration, createStorage, r2Endpoint, tokenCredentials } from './cloudflare-storage.mjs'

const config = {
    CLOUDFLARE_ACCOUNT_ID: 'a'.repeat(32),
    CLOUDFLARE_API_TOKEN: 'test-token',
    SCREEN_LIBRARY_R2_BUCKET: 'screens',
    SCREEN_LIBRARY_PUBLIC_URL: 'https://screens.example.com',
}

test('configuration requires each R2 credential and rejects unsafe delivery origins', () => {
    assert.equal(configuration(config).SCREEN_LIBRARY_PUBLIC_URL, config.SCREEN_LIBRARY_PUBLIC_URL)
    for (const key of Object.keys(config)) assert.throws(() => configuration({ ...config, [key]: '' }))
    for (const url of ['http://example.com', 'https://user:pass@example.com', 'https://example.com/path'])
        assert.throws(() => configuration({ ...config, SCREEN_LIBRARY_PUBLIC_URL: url }))
})

test('EU buckets use the jurisdiction endpoint and reject malformed jurisdictions', () => {
    assert.equal(
        r2Endpoint({ ...config, SCREEN_LIBRARY_R2_JURISDICTION: 'eu' }),
        `https://${config.CLOUDFLARE_ACCOUNT_ID}.eu.r2.cloudflarestorage.com`
    )
    assert.equal(r2Endpoint(config), `https://${config.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`)
    assert.throws(() => r2Endpoint({ ...config, SCREEN_LIBRARY_R2_JURISDICTION: 'eu/path' }))
})

test('an active account token derives R2 credentials without additional secrets', async () => {
    const calls = []
    const credentials = await tokenCredentials('abc', config.CLOUDFLARE_ACCOUNT_ID, async (url) => {
        calls.push(url)
        return Response.json({
            success: true,
            result: { id: 'b'.repeat(32), status: 'active' },
        })
    })
    assert.equal(credentials.accessKeyId, 'b'.repeat(32))
    assert.equal(credentials.secretAccessKey, 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
    assert.deepEqual(calls, [
        `https://api.cloudflare.com/client/v4/accounts/${config.CLOUDFLARE_ACCOUNT_ID}/tokens/verify`,
    ])
})

test('a user token falls back to the user verification endpoint', async () => {
    const calls = []
    const credentials = await tokenCredentials('abc', config.CLOUDFLARE_ACCOUNT_ID, async (url) => {
        calls.push(url)
        if (url.includes('/accounts/')) return new Response(null, { status: 403 })
        return Response.json({ success: true, result: { id: 'c'.repeat(32), status: 'active' } })
    })
    assert.equal(credentials.accessKeyId, 'c'.repeat(32))
    assert.deepEqual(calls, [
        `https://api.cloudflare.com/client/v4/accounts/${config.CLOUDFLARE_ACCOUNT_ID}/tokens/verify`,
        'https://api.cloudflare.com/client/v4/user/tokens/verify',
    ])
})

test('a user token also falls back from an unsuccessful v4 response', async () => {
    let calls = 0
    const credentials = await tokenCredentials('abc', config.CLOUDFLARE_ACCOUNT_ID, async () => {
        calls += 1
        return calls === 1
            ? Response.json({ success: false, errors: [{ code: 1000 }] })
            : Response.json({ success: true, result: { id: 'd'.repeat(32), status: 'active' } })
    })
    assert.equal(credentials.accessKeyId, 'd'.repeat(32))
    assert.equal(calls, 2)
})

test('inactive, invalid and rejected Cloudflare tokens fail closed', async () => {
    await assert.rejects(
        tokenCredentials('abc', config.CLOUDFLARE_ACCOUNT_ID, async () =>
            Response.json({
                success: true,
                result: { id: 'b'.repeat(32), status: 'expired' },
            })
        ),
        /not active/
    )
    await assert.rejects(
        tokenCredentials('abc', config.CLOUDFLARE_ACCOUNT_ID, async () => new Response(null, { status: 401 })),
        /HTTP 401, 401/
    )
    await assert.rejects(
        tokenCredentials('abc', 'invalid', async () => Response.json({ success: true })),
        /account ID/
    )
})

test('R2 reads remain callable when passed as detached publisher callbacks', async () => {
    class Command {
        constructor(input) {
            this.input = input
        }
    }
    class S3Client {
        async send(command) {
            assert.deepEqual(command.input, { Bucket: config.SCREEN_LIBRARY_R2_BUCKET, Key: 'existing.json' })
            return {
                Body: { transformToByteArray: async () => Buffer.from('{"ok":true}') },
                ETag: 'etag',
            }
        }
    }
    const storage = await createStorage(config, {
        request: async () => Response.json({ success: true, result: { id: 'b'.repeat(32), status: 'active' } }),
        loadS3: async () => ({
            S3Client,
            PutObjectCommand: Command,
            GetObjectCommand: Command,
            ListObjectsV2Command: Command,
        }),
    })

    const read = storage.read
    assert.equal((await read('existing.json')).toString(), '{"ok":true}')
    assert.deepEqual(await storage.readWithMetadata('existing.json'), {
        body: Buffer.from('{"ok":true}'),
        etag: 'etag',
    })
})
