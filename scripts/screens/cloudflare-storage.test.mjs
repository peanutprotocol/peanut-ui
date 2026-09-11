import { test } from 'node:test'
import assert from 'node:assert/strict'
import { configuration, uploadPreview } from './cloudflare-storage.mjs'
const config = {
    CLOUDFLARE_ACCOUNT_ID: 'a'.repeat(32),
    CLOUDFLARE_IMAGES_TOKEN: 'test-token',
    SCREEN_LIBRARY_R2_ACCESS_KEY_ID: 'key',
    SCREEN_LIBRARY_R2_SECRET_ACCESS_KEY: 'secret',
    SCREEN_LIBRARY_R2_BUCKET: 'screens',
    SCREEN_LIBRARY_PUBLIC_URL: 'https://screens.example.com',
    SCREEN_LIBRARY_IMAGES_HASH: 'hash',
    SCREEN_LIBRARY_IMAGES_VARIANT: 'screen-preview',
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
