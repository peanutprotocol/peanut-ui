import { test } from 'node:test'
import assert from 'node:assert/strict'
import { configuration, deleteHostedImage, r2Endpoint, tokenCredentials } from './cloudflare-storage.mjs'

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

test('one active token derives R2 credentials without additional secrets', async () => {
    const credentials = await tokenCredentials('abc', async () =>
        Response.json({
            success: true,
            result: { id: 'b'.repeat(32), status: 'active' },
        })
    )
    assert.equal(credentials.accessKeyId, 'b'.repeat(32))
    assert.equal(credentials.secretAccessKey, 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
    await assert.rejects(
        tokenCredentials('abc', async () =>
            Response.json({
                success: true,
                result: { id: 'b'.repeat(32), status: 'expired' },
            })
        )
    )
    await assert.rejects(tokenCredentials('abc', async () => new Response(null, { status: 401 })))
})

test('legacy Cloudflare Images deletion is strict and idempotent', async () => {
    const id = `ps-${'a'.repeat(29)}`
    let request
    await deleteHostedImage(config, id, async (url, options) => {
        request = { url, options }
        return Response.json({ success: true })
    })
    assert.equal(request.options.method, 'DELETE')
    assert.equal(request.options.headers.Authorization, `Bearer ${config.CLOUDFLARE_API_TOKEN}`)
    assert.equal(
        request.url,
        `https://api.cloudflare.com/client/v4/accounts/${config.CLOUDFLARE_ACCOUNT_ID}/images/v1/${id}`
    )
    await deleteHostedImage(config, id, async () => new Response(null, { status: 404 }))
    await assert.rejects(deleteHostedImage(config, 'unsafe/id', async () => Response.json({ success: true })))
    await assert.rejects(deleteHostedImage(config, id, async () => Response.json({ success: false })))
})
