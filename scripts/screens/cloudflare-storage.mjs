/** Trusted publisher only. Images holds all screenshots; R2 holds report data and archives. */
import { createHash } from 'node:crypto'
import { normalizePublicOrigin } from './public-origin.mjs'
export function configuration(env = process.env) {
    const keys = [
        'CLOUDFLARE_ACCOUNT_ID',
        'CLOUDFLARE_API_TOKEN',
        'SCREEN_LIBRARY_R2_BUCKET',
        'SCREEN_LIBRARY_PUBLIC_URL',
        'SCREEN_LIBRARY_IMAGES_HASH',
        'SCREEN_LIBRARY_IMAGES_VARIANT',
    ]
    for (const key of keys) if (!env[key]) throw new Error(`${key} is not configured`)
    if (!/^[a-f0-9]{32}$/.test(env.CLOUDFLARE_ACCOUNT_ID)) throw new Error('Invalid Cloudflare account ID')
    for (const key of ['SCREEN_LIBRARY_IMAGES_HASH', 'SCREEN_LIBRARY_IMAGES_VARIANT'])
        if (!/^[\w-]+$/.test(env[key])) throw new Error(`Invalid ${key}`)
    return { ...env, SCREEN_LIBRARY_PUBLIC_URL: normalizePublicOrigin(env.SCREEN_LIBRARY_PUBLIC_URL) }
}
export function r2Endpoint(env = process.env) {
    const jurisdiction = env.SCREEN_LIBRARY_R2_JURISDICTION || 'default'
    if (!['default', 'eu', 'us', 'fedramp'].includes(jurisdiction)) throw new Error('Invalid R2 jurisdiction')
    if (!/^[a-f0-9]{32}$/.test(env.CLOUDFLARE_ACCOUNT_ID ?? '')) throw new Error('Invalid Cloudflare account ID')
    return `https://${env.CLOUDFLARE_ACCOUNT_ID}${jurisdiction === 'default' ? '' : `.${jurisdiction}`}.r2.cloudflarestorage.com`
}
export async function tokenCredentials(token, request = fetch) {
    const response = await request('https://api.cloudflare.com/client/v4/user/tokens/verify', {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(30000),
    })
    if (!response.ok) throw new Error('Cloudflare token verification failed')
    const data = await response.json()
    if (!data.success || data.result?.status !== 'active' || !/^[a-f0-9]{32}$/.test(data.result?.id ?? ''))
        throw new Error('Cloudflare token is not active or has no valid ID')
    return { accessKeyId: data.result.id, secretAccessKey: createHash('sha256').update(token).digest('hex') }
}
export async function createStorage(env = process.env) {
    const config = configuration(env)
    const { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command } = await import('@aws-sdk/client-s3')
    const client = new S3Client({
        region: 'auto',
        endpoint: r2Endpoint(config),
        credentials: await tokenCredentials(config.CLOUDFLARE_API_TOKEN),
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
    // Cloudflare Images image IDs are limited to 32 characters. The metadata
    // carries the complete source digest and filename for reuse verification.
    const id = `ps-${name.slice(0, 29)}`
    const endpoint = `https://api.cloudflare.com/client/v4/accounts/${config.CLOUDFLARE_ACCOUNT_ID}/images/v1`
    const headers = { Authorization: `Bearer ${config.CLOUDFLARE_API_TOKEN}` }

    const source = { sourceSha256: name.slice(0, 64), sourceFilename: name }
    const matchesSource = (image) =>
        image?.id === id && image.meta?.sourceSha256 === source.sourceSha256 && image.meta?.sourceFilename === name
    const readImage = async () => {
        const response = await request(`${endpoint}/${id}`, { headers })
        if (response.status === 404) return null
        if (!response.ok) throw new Error('Cloudflare Images lookup failed')
        const data = await response.json()
        if (!data.success || data.result?.id !== id) throw new Error('Cloudflare Images lookup failed')
        return data.result
    }
    const uploadImage = async () => {
        const body = new FormData()
        body.set('id', id)
        body.set('requireSignedURLs', 'false')
        body.set('metadata', JSON.stringify(source))
        body.set('file', new Blob([bytes], { type: name.endsWith('.png') ? 'image/png' : 'image/webp' }), name)
        const uploaded = await request(endpoint, { method: 'POST', headers, body })
        const data = await uploaded.json().catch(() => ({}))
        if (!uploaded.ok || !data.success || data.result?.id !== id) throw new Error('Cloudflare Images upload failed')
        return data.result
    }

    let image = await readImage()
    if (!image) image = await uploadImage()
    if (!matchesSource(image)) {
        // Migrate images uploaded before source metadata was added, but never
        // overwrite a populated, conflicting identity.
        if (image.meta && Object.keys(image.meta).length > 0) throw new Error('Cloudflare preview metadata mismatch')
        if (image.filename !== name) throw new Error('Cloudflare preview identity mismatch')
        const repaired = await request(`${endpoint}/${id}`, {
            method: 'PATCH',
            headers: { ...headers, 'content-type': 'application/json' },
            body: JSON.stringify({ metadata: source }),
        })
        const data = await repaired.json().catch(() => ({}))
        if (!repaired.ok || !data.success || !matchesSource(data.result))
            throw new Error('Cloudflare preview metadata repair failed')
        image = data.result
    }
    if (!matchesSource(image)) throw new Error('Cloudflare preview metadata mismatch')

    const delivery = `https://imagedelivery.net/${config.SCREEN_LIBRARY_IMAGES_HASH}/${id}/${config.SCREEN_LIBRARY_IMAGES_VARIANT}`
    const check = await request(delivery, { method: 'HEAD' })
    if (!check.ok || !check.headers.get('content-type')?.startsWith('image/'))
        throw new Error('Cloudflare preview delivery is not public')
    return delivery
}
