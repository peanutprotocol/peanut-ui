import { test } from 'node:test'
import assert from 'node:assert/strict'
import { configuration, uploadPreview, r2Endpoint, tokenCredentials } from './cloudflare-storage.mjs'
const config = {
    CLOUDFLARE_ACCOUNT_ID: 'a'.repeat(32),
    CLOUDFLARE_API_TOKEN: 'test-token',
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
test('new PNG upload verifies source metadata and public delivery before publishing', async () => {
    const bytes = Buffer.from('original'),
        name = 'b'.repeat(64) + '.png',
        calls = []
    const responses = [
        new Response(null, { status: 404 }),
        Response.json({
            success: true,
            result: {
                id: `ps-${name.slice(0, 29)}`,
                filename: name,
                meta: { sourceSha256: name.slice(0, 64), sourceFilename: name },
            },
        }),
        new Response(null, { headers: { 'content-type': 'image/webp' } }),
    ]
    const url = await uploadPreview(config, name, bytes, async (url, options) => {
        calls.push({ url, options })
        return responses.shift()
    })
    assert.match(url, /^https:\/\/imagedelivery.net\/hash\//)
    assert.equal(calls[1].options.body.get('requireSignedURLs'), 'false')
    assert.deepEqual(JSON.parse(calls[1].options.body.get('metadata')), {
        sourceSha256: name.slice(0, 64),
        sourceFilename: name,
    })
    assert.equal(calls[1].options.body.get('file').type, 'image/png')
    assert.equal(calls[2].options.headers, undefined)
})
test('deduplicated image is reused only when source metadata matches', async () => {
    const name = 'c'.repeat(64) + '.webp'
    const calls = []
    const url = await uploadPreview(config, name, Buffer.from('expected'), async (requestUrl, options) => {
        calls.push({ requestUrl, options })
        return calls.length === 1
            ? Response.json({
                  success: true,
                  result: {
                      id: `ps-${name.slice(0, 29)}`,
                      filename: name,
                      meta: { sourceSha256: name.slice(0, 64), sourceFilename: name },
                  },
              })
            : new Response(null, { headers: { 'content-type': 'image/webp' } })
    })
    assert.match(url, /\/screenpreview$/)
    assert.equal(calls.length, 2)
})
test('legacy image metadata is repaired when its source filename matches', async () => {
    const name = 'd'.repeat(64) + '.png'
    let calls = 0
    const url = await uploadPreview(config, name, Buffer.from('legacy'), async (requestUrl, options) => {
        calls += 1
        if (calls === 1)
            return Response.json({ success: true, result: { id: `ps-${name.slice(0, 29)}`, filename: name } })
        if (calls === 2)
            return Response.json({
                success: true,
                result: {
                    id: `ps-${name.slice(0, 29)}`,
                    filename: name,
                    meta: { sourceSha256: name.slice(0, 64), sourceFilename: name },
                },
            })
        return new Response(null, { headers: { 'content-type': 'image/png' } })
    })
    assert.match(url, /\/screenpreview$/)
    assert.equal(calls, 3)
})
test('API failures and private/missing variants cannot publish a valid image URL', async () => {
    for (const status of [401, 429, 500])
        await assert.rejects(
            uploadPreview(config, 'c'.repeat(64) + '.png', Buffer.from('x'), async () => new Response(null, { status }))
        )
    const name = 'e'.repeat(64) + '.png'
    let calls = 0
    await assert.rejects(
        uploadPreview(config, name, Buffer.from('x'), async () =>
            ++calls === 1
                ? Response.json({
                      success: true,
                      result: {
                          id: `ps-${name.slice(0, 29)}`,
                          filename: name,
                          meta: { sourceSha256: name.slice(0, 64), sourceFilename: name },
                      },
                  })
                : new Response(null, { status: 403 })
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
