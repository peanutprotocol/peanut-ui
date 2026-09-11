/** Trusted publisher only. Images holds all screenshots; R2 holds report data and archives. */
export function configuration(env = process.env) {
    const keys = [
        'CLOUDFLARE_ACCOUNT_ID',
        'CLOUDFLARE_IMAGES_TOKEN',
        'SCREEN_LIBRARY_R2_ACCESS_KEY_ID',
        'SCREEN_LIBRARY_R2_SECRET_ACCESS_KEY',
        'SCREEN_LIBRARY_R2_BUCKET',
        'SCREEN_LIBRARY_PUBLIC_URL',
        'SCREEN_LIBRARY_IMAGES_HASH',
        'SCREEN_LIBRARY_IMAGES_VARIANT',
    ]
    for (const key of keys) if (!env[key]) throw new Error(`${key} is not configured`)
    if (!/^[a-f0-9]{32}$/.test(env.CLOUDFLARE_ACCOUNT_ID)) throw new Error('Invalid Cloudflare account ID')
    for (const key of ['SCREEN_LIBRARY_IMAGES_HASH', 'SCREEN_LIBRARY_IMAGES_VARIANT'])
        if (!/^[\w-]+$/.test(env[key])) throw new Error(`Invalid ${key}`)
    const url = new URL(env.SCREEN_LIBRARY_PUBLIC_URL)
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/')
        throw new Error('Store URL must be an HTTPS origin')
    return { ...env, SCREEN_LIBRARY_PUBLIC_URL: url.origin }
}
export function r2Endpoint(env = process.env) {
    const jurisdiction = env.SCREEN_LIBRARY_R2_JURISDICTION || 'default'
    if (!['default', 'eu', 'us', 'fedramp'].includes(jurisdiction)) throw new Error('Invalid R2 jurisdiction')
    if (!/^[a-f0-9]{32}$/.test(env.CLOUDFLARE_ACCOUNT_ID ?? '')) throw new Error('Invalid Cloudflare account ID')
    return `https://${env.CLOUDFLARE_ACCOUNT_ID}${jurisdiction === 'default' ? '' : `.${jurisdiction}`}.r2.cloudflarestorage.com`
}
export async function createStorage(env = process.env) {
    const config = configuration(env)
    const { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command } = await import('@aws-sdk/client-s3')
    const client = new S3Client({
        region: 'auto',
        endpoint: r2Endpoint(config),
        credentials: {
            accessKeyId: config.SCREEN_LIBRARY_R2_ACCESS_KEY_ID,
            secretAccessKey: config.SCREEN_LIBRARY_R2_SECRET_ACCESS_KEY,
        },
    })
    const Bucket = config.SCREEN_LIBRARY_R2_BUCKET
    const url = (key) => `${config.SCREEN_LIBRARY_PUBLIC_URL}/screen-data/${key}`
    return {
        async put(key, body, options = {}) {
            await client.send(
                new PutObjectCommand({
                    Bucket,
                    Key: key,
                    Body: body,
                    ContentType: options.contentType,
                    CacheControl: `public, max-age=${options.cacheControlMaxAge ?? 31536000}`,
                    ...(!options.allowOverwrite ? { IfNoneMatch: '*' } : {}),
                })
            )
            return { url: url(key), pathname: key }
        },
        async read(key) {
            const result = await client.send(new GetObjectCommand({ Bucket, Key: key }))
            return Buffer.from(await result.Body.transformToByteArray())
        },
        async list({ prefix, cursor, limit = 1000 }) {
            const result = await client.send(
                new ListObjectsV2Command({ Bucket, Prefix: prefix, ContinuationToken: cursor, MaxKeys: limit })
            )
            return {
                blobs: (result.Contents ?? []).map(({ Key }) => ({ pathname: Key, url: url(Key) })),
                cursor: result.NextContinuationToken,
                hasMore: result.IsTruncated,
            }
        },
        preview: (name, bytes) => uploadPreview(config, name, bytes),
    }
}
async function cloudflareRequest(url, options) {
    for (let attempt = 0; ; attempt++) {
        const response = await fetch(url, { ...options, signal: AbortSignal.timeout(30000) })
        if (attempt >= 5 || (response.status !== 429 && response.status < 500)) return response
        const seconds = Number(response.headers.get('retry-after')) || 2 ** attempt
        await response.arrayBuffer()
        await new Promise((done) => setTimeout(done, Math.min(60, seconds) * 1000))
    }
}
export async function uploadPreview(config, name, bytes, request = cloudflareRequest) {
    if (!/^[a-f0-9]{64}\.(png|webp)$/.test(name)) throw new Error('Invalid preview name')
    const id = `peanut-screen-${name.slice(0, 64)}`
    const endpoint = `https://api.cloudflare.com/client/v4/accounts/${config.CLOUDFLARE_ACCOUNT_ID}/images/v1`
    const headers = { Authorization: `Bearer ${config.CLOUDFLARE_IMAGES_TOKEN}` }
    // Verify original bytes on reuse, never trust a custom ID alone.
    let response = await request(`${endpoint}/${id}/blob`, { headers })
    if (response.status === 404) {
        const body = new FormData()
        body.set('id', id)
        body.set('requireSignedURLs', 'false')
        body.set('file', new Blob([bytes], { type: name.endsWith('.png') ? 'image/png' : 'image/webp' }), name)
        const uploaded = await request(endpoint, { method: 'POST', headers, body })
        if (!uploaded.ok || !(await uploaded.json()).success) throw new Error('Cloudflare Images upload failed')
        response = await request(`${endpoint}/${id}/blob`, { headers })
    }
    if (!response.ok || !Buffer.from(await response.arrayBuffer()).equals(bytes))
        throw new Error('Cloudflare preview original mismatch or unavailable')
    const delivery = `https://imagedelivery.net/${config.SCREEN_LIBRARY_IMAGES_HASH}/${id}/${config.SCREEN_LIBRARY_IMAGES_VARIANT}`
    const check = await request(delivery, { method: 'HEAD' })
    if (!check.ok || !check.headers.get('content-type')?.startsWith('image/'))
        throw new Error('Cloudflare preview delivery is not public')
    return delivery
}
