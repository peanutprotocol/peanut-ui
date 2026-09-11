import { test } from 'node:test'
import assert from 'node:assert/strict'
import { configuration, uploadPreview, r2Endpoint, tokenCredentials } from './cloudflare-storage.mjs'
const config = {
    CLOUDFLARE_ACCOUNT_ID: 'a'.repeat(32),
    CLOUDFLARE_PUBLISH_TOKEN: 'test-token',
    SCREEN_LIBRARY_R2_BUCKET: 'screens',
    SCREEN_LIBRARY_PUBLIC_URL: 'https://screens.example.com',
    SCREEN_LIBRARY_IMAGES_HASH: 'hash',
    SCREEN_LIBRARY_IMAGES_VARIANT: 'screenpreview',
}
test('configuration requires each credential and rejects unsafe delivery origins', () => {
    assert.equal(configuration(config).SCREEN_LIBRARY_PUBLIC_URL, config.SCREEN_LIBRARY_PUBLIC_URL)
    for (const key of Object.keys(config)) assert.throws(() => configuration({ ...config, [key]: '' }))
    for (const url of ['http://example.com', 'https://user:pass@example.com', 'https://example.com/path'])
        assert.throws(() => configuration({ ...config, SCREEN_LIBRARY_PUBLIC_URL: url }))
})
test('new PNG upload verifies original bytes and public delivery before publishing', async () => {
    const bytes = Buffer.from('original'),
        calls = []
    const responses = [
        new Response(null, { status: 404 }),
        Response.json({ success: true }),
        new Response(bytes),
        new Response(null, { headers: { 'content-type': 'image/webp' } }),
    ]
    const url = await uploadPreview(config, 'b'.repeat(64) + '.png', bytes, async (url, options) => {
        calls.push({ url, options })
        return responses.shift()
    })
    assert.match(url, /^https:\/\/imagedelivery.net\/hash\//)
    assert.equal(calls[1].options.body.get('requireSignedURLs'), 'false')
    assert.equal(calls[1].options.body.get('file').type, 'image/png')
    assert.equal(calls[3].options.headers, undefined)
})
test('deduplicated image is reused only when original bytes match', async () => {
    await assert.rejects(
        uploadPreview(config, 'c'.repeat(64) + '.webp', Buffer.from('expected'), async () => new Response('different')),
        /mismatch/
    )
})
test('API failures and private/missing variants cannot publish a valid image URL', async () => {
    for (const status of [401, 429, 500])
        await assert.rejects(
            uploadPreview(config, 'c'.repeat(64) + '.png', Buffer.from('x'), async () => new Response(null, { status }))
        )
    let calls = 0
    await assert.rejects(
        uploadPreview(config, 'c'.repeat(64) + '.png', Buffer.from('x'), async () =>
            ++calls === 1 ? new Response('x') : new Response(null, { status: 403 })
        ),
        /not public/
    )
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
        Response.json({ success: true, result: { id: 'b'.repeat(32), status: 'active' } })
    )
    assert.equal(credentials.accessKeyId, 'b'.repeat(32))
    assert.equal(credentials.secretAccessKey, 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
    await assert.rejects(
        tokenCredentials('abc', async () =>
            Response.json({ success: true, result: { id: 'b'.repeat(32), status: 'expired' } })
        )
    )
    await assert.rejects(tokenCredentials('abc', async () => new Response(null, { status: 401 })))
})
