/** Trusted publisher only. Private R2 holds screenshots, report data and archives. */
import { createHash } from 'node:crypto'
import { normalizePublicOrigin } from './public-origin.mjs'
export function configuration(env = process.env) {
    const keys = [
        'CLOUDFLARE_ACCOUNT_ID',
        'CLOUDFLARE_API_TOKEN',
        'SCREEN_LIBRARY_R2_BUCKET',
        'SCREEN_LIBRARY_PUBLIC_URL',
    ]
    for (const key of keys) if (!env[key]) throw new Error(`${key} is not configured`)
    if (!/^[a-f0-9]{32}$/.test(env.CLOUDFLARE_ACCOUNT_ID)) throw new Error('Invalid Cloudflare account ID')
    return {
        ...env,
        SCREEN_LIBRARY_PUBLIC_URL: normalizePublicOrigin(env.SCREEN_LIBRARY_PUBLIC_URL),
    }
}
export function r2Endpoint(env = process.env) {
    const jurisdiction = env.SCREEN_LIBRARY_R2_JURISDICTION || 'default'
    if (!['default', 'eu', 'us', 'fedramp'].includes(jurisdiction)) throw new Error('Invalid R2 jurisdiction')
    if (!/^[a-f0-9]{32}$/.test(env.CLOUDFLARE_ACCOUNT_ID ?? '')) throw new Error('Invalid Cloudflare account ID')
    return `https://${env.CLOUDFLARE_ACCOUNT_ID}${jurisdiction === 'default' ? '' : `.${jurisdiction}`}.r2.cloudflarestorage.com`
}
export async function tokenCredentials(token, accountId, request = fetch) {
    if (!/^[a-f0-9]{32}$/.test(accountId ?? '')) throw new Error('Invalid Cloudflare account ID')

    // R2 supports both account-owned and legacy user-owned API tokens. Their
    // verification endpoints are distinct even though both token types derive
    // the same S3 credentials.
    const endpoints = [
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/tokens/verify`,
        'https://api.cloudflare.com/client/v4/user/tokens/verify',
    ]
    const statuses = []
    for (const endpoint of endpoints) {
        const response = await request(endpoint, {
            headers: { Authorization: `Bearer ${token}` },
            signal: AbortSignal.timeout(30000),
        })
        if (!response.ok) {
            statuses.push(response.status)
            continue
        }
        const data = await response.json()
        // Cloudflare may return an unsuccessful v4 envelope for the wrong
        // ownership-scoped endpoint without making the HTTP request fail.
        if (!data.success) {
            statuses.push(response.status)
            continue
        }
        if (data.result?.status !== 'active' || !/^[a-f0-9]{32}$/.test(data.result?.id ?? ''))
            throw new Error('Cloudflare token is not active or has no valid ID')
        return {
            accessKeyId: data.result.id,
            secretAccessKey: createHash('sha256').update(token).digest('hex'),
        }
    }
    throw new Error(`Cloudflare token verification failed (HTTP ${statuses.join(', ')})`)
}
export async function createStorage(
    env = process.env,
    { request = fetch, loadS3 = () => import('@aws-sdk/client-s3') } = {}
) {
    const config = configuration(env)
    const { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command } = await loadS3()
    const client = new S3Client({
        region: 'auto',
        endpoint: r2Endpoint(config),
        credentials: await tokenCredentials(config.CLOUDFLARE_API_TOKEN, config.CLOUDFLARE_ACCOUNT_ID, request),
    })
    const Bucket = config.SCREEN_LIBRARY_R2_BUCKET
    const url = (key) => `${config.SCREEN_LIBRARY_PUBLIC_URL}/screen-data/${key}`
    const readWithMetadata = async (key) => {
        const result = await client.send(new GetObjectCommand({ Bucket, Key: key }))
        return { body: Buffer.from(await result.Body.transformToByteArray()), etag: result.ETag }
    }
    return {
        async put(key, body, options = {}) {
            await client.send(
                new PutObjectCommand({
                    Bucket,
                    Key: key,
                    Body: body,
                    ContentType: options.contentType,
                    CacheControl: `private, max-age=${options.cacheControlMaxAge ?? 31536000}`,
                    ...(!options.allowOverwrite ? { IfNoneMatch: '*' } : {}),
                    ...(options.ifMatch ? { IfMatch: options.ifMatch } : {}),
                })
            )
            return { url: url(key), pathname: key }
        },
        readWithMetadata,
        async read(key) {
            return (await readWithMetadata(key)).body
        },
        async list({ prefix, cursor, limit = 1000 }) {
            const result = await client.send(
                new ListObjectsV2Command({
                    Bucket,
                    Prefix: prefix,
                    ContinuationToken: cursor,
                    MaxKeys: limit,
                })
            )
            return {
                blobs: (result.Contents ?? []).map(({ Key }) => ({
                    pathname: Key,
                    url: url(Key),
                })),
                cursor: result.NextContinuationToken,
                hasMore: result.IsTruncated,
            }
        },
        removeImage: (id) => deleteHostedImage(config, id),
    }
}

async function cloudflareRequest(url, options, request = fetch) {
    for (let attempt = 0; ; attempt++) {
        const response = await request(url, {
            ...options,
            signal: AbortSignal.timeout(30000),
        })
        if (attempt >= 5 || (response.status !== 429 && response.status < 500)) return response
        const seconds = Number(response.headers.get('retry-after')) || 2 ** attempt
        await response.arrayBuffer()
        await new Promise((done) => setTimeout(done, Math.min(60, seconds) * 1000))
    }
}

export async function deleteHostedImage(config, id, request = fetch) {
    if (!/^(?:ps-[a-f0-9]{29}|peanut-screen-[a-f0-9]{64})$/.test(id ?? ''))
        throw new Error('Invalid Cloudflare Images ID')
    const response = await cloudflareRequest(
        `https://api.cloudflare.com/client/v4/accounts/${config.CLOUDFLARE_ACCOUNT_ID}/images/v1/${encodeURIComponent(id)}`,
        {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${config.CLOUDFLARE_API_TOKEN}` },
        },
        request
    )
    if (response.status === 404) return
    const data = await response.json().catch(() => ({}))
    if (!response.ok || data.success !== true) throw new Error('Cloudflare Images deletion failed')
}
