import {
    COLLECTION_LOCALES,
    collectionId,
    composeCollection,
    missingByLocale,
    normalizeCollectionSpec,
    validateCollection,
} from '../collection-core.mjs'
import { constantTimeEqual, verifiedAccessIdentity } from '../access.mjs'

const responseHeaders = {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
}
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: responseHeaders })
const error = (message, status) => json({ error: message }, status)
const safeId = /^[a-z0-9][a-z0-9-]{0,119}$/
const safeRepository = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/
const CAPTURE_STALE_AFTER_MS = 90 * 60 * 1000

async function actor(request, env, ctx) {
    const internal = request.headers.get('authorization')
    if (
        env.COLLECTION_SERVICE_TOKEN &&
        (await constantTimeEqual(internal ?? '', `Bearer ${env.COLLECTION_SERVICE_TOKEN}`))
    )
        return 'mcp@internal'
    return (await verifiedAccessIdentity(ctx, env.SCREEN_LIBRARY_ACCESS_AUD)) ?? null
}

async function readJson(bucket, key) {
    const object = await bucket.get(key)
    if (!object) return null
    return object.json()
}

async function requestBody(request) {
    const length = Number(request.headers.get('content-length') || 0)
    if (length > 64 * 1024) throw new Error('Request is too large')
    return request.json()
}

function bestEntry(entries, locale) {
    return entries
        .filter(
            (entry) =>
                entry?.complete === true &&
                entry.locale === locale &&
                (entry.source ?? 'synthetic') === 'synthetic' &&
                entry.reportType === 'capture' &&
                entry.branch === 'dev'
        )
        .sort(
            (a, b) =>
                (b.sequence ?? 0) - (a.sequence ?? 0) ||
                (b.attempt ?? 0) - (a.attempt ?? 0) ||
                String(b.path).localeCompare(String(a.path))
        )[0]
}

async function sources(bucket, locales) {
    const entries = (await readJson(bucket, 'index.json')) ?? []
    const result = { reports: {}, reportPaths: {} }
    for (const locale of locales) {
        const entry = bestEntry(entries, locale)
        if (!entry) throw new Error(`No complete ${locale} library capture is available`)
        const report = await readJson(bucket, `reports/${entry.path}/manifest.json`)
        if (!report) throw new Error(`The ${locale} source report is unavailable`)
        result.reports[locale] = report
        result.reportPaths[locale] = entry.path
    }
    return result
}

async function github(requestPath, env, options = {}) {
    if (!safeRepository.test(env.GITHUB_REPOSITORY ?? '') || !env.GITHUB_ACTIONS_TOKEN)
        throw new Error('GitHub dispatch is not configured')
    const response = await (env.GITHUB_FETCH ?? fetch)(
        `https://api.github.com/repos/${env.GITHUB_REPOSITORY}${requestPath}`,
        {
            ...options,
            headers: {
                Accept: 'application/vnd.github+json',
                Authorization: `Bearer ${env.GITHUB_ACTIONS_TOKEN}`,
                'User-Agent': 'peanut-screen-library-collections',
                'X-GitHub-Api-Version': '2022-11-28',
                ...options.headers,
            },
        }
    )
    if (!response.ok) throw new Error(`GitHub request failed (${response.status})`)
    return response.status === 204 ? null : response.json()
}

async function queueCapture(collection, env) {
    if (!collection.missing.length) return collection
    const ref = await github('/git/ref/heads/dev', env)
    const targetCommit = ref?.object?.sha
    if (!/^[a-f0-9]{40}$/.test(targetCommit ?? '')) throw new Error('GitHub returned an invalid dev revision')
    const attempt = crypto.randomUUID()
    const request = {
        schema: 1,
        collectionId: collection.id,
        attempt,
        targetCommit,
        requestedAt: new Date().toISOString(),
        screens: missingByLocale(collection),
    }
    const previousCapture = collection.capture
    collection.capture = {
        status: 'queued',
        attempt,
        targetCommit,
        requestedAt: request.requestedAt,
    }
    try {
        await env.REPORTS.put(`collection-requests/${collection.id}.json`, JSON.stringify(request), {
            httpMetadata: {
                contentType: 'application/json',
                cacheControl: 'no-store',
            },
        })
        await env.REPORTS.put(`collections/${collection.id}/manifest.json`, JSON.stringify(collection), {
            httpMetadata: {
                contentType: 'application/json',
                cacheControl: 'private, max-age=10',
            },
        })
        await github('/actions/workflows/screen-library-collection.yml/dispatches', env, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ref: 'dev',
                inputs: { collection_id: collection.id },
            }),
        })
    } catch (cause) {
        collection.capture = {
            ...previousCapture,
            status: 'failed',
            targetCommit,
            requestedAt: request.requestedAt,
            failedAt: new Date().toISOString(),
            reason: 'The capture workflow could not be dispatched.',
        }
        await env.REPORTS.put(`collections/${collection.id}/manifest.json`, JSON.stringify(collection), {
            httpMetadata: {
                contentType: 'application/json',
                cacheControl: 'private, max-age=10',
            },
        })
        throw cause
    }
    return collection
}

async function screenSearch(url, env) {
    const locale = url.searchParams.get('locale') || 'en'
    if (!COLLECTION_LOCALES.includes(locale)) return error('Unsupported locale', 400)
    const q = (url.searchParams.get('q') || '').trim().toLowerCase().slice(0, 200)
    const { reports, reportPaths } = await sources(env.REPORTS, [locale])
    const screens = reports[locale].screens
        .filter((screen) => !q || `${screen.id} ${screen.name} ${screen.flow}`.toLowerCase().includes(q))
        .slice(0, 200)
        .map((screen) => ({
            id: screen.id,
            name: screen.name,
            flow: screen.flow,
            kind: screen.kind,
            available: screen.status === 'captured' && Boolean(screen.image),
        }))
    return json({ locale, source: reportPaths[locale], screens })
}

async function createCollection(request, actorEmail, env) {
    const spec = normalizeCollectionSpec(await requestBody(request))
    const source = await sources(env.REPORTS, spec.locales)
    const id = collectionId(spec.title)
    if (await env.REPORTS.head(`collections/${id}/manifest.json`)) return error('Collection already exists', 409)
    let collection = composeCollection({
        id,
        spec,
        ...source,
        createdBy: actorEmail,
        createdAt: new Date(),
    })
    await env.REPORTS.put(`collections/${id}/manifest.json`, JSON.stringify(collection), {
        httpMetadata: {
            contentType: 'application/json',
            cacheControl: 'private, max-age=10',
        },
    })
    await env.REPORTS.put(
        `collection-entries/${id}.json`,
        JSON.stringify({
            id,
            title: collection.title,
            createdAt: collection.createdAt,
            complete: collection.complete,
        }),
        {
            httpMetadata: {
                contentType: 'application/json',
                cacheControl: 'no-store',
            },
        }
    )
    if (spec.captureMissing && collection.missing.length) {
        try {
            collection = await queueCapture(collection, env)
        } catch {
            return json(
                {
                    error: 'The capture workflow could not be dispatched. Retry this collection capture.',
                    collection,
                    url: `${env.SCREEN_LIBRARY_PUBLIC_URL.replace(/\/$/, '')}/collections/${id}/`,
                },
                503
            )
        }
    }
    return json(
        {
            collection,
            url: `${env.SCREEN_LIBRARY_PUBLIC_URL.replace(/\/$/, '')}/collections/${id}/`,
        },
        201
    )
}

async function collectionRoute(request, id, action, env) {
    if (!safeId.test(id)) return error('Invalid collection ID', 400)
    const key = `collections/${id}/manifest.json`
    const collection = await readJson(env.REPORTS, key)
    if (!collection) return error('Collection not found', 404)
    const validated = validateCollection(collection)
    if (request.method === 'GET' && !action)
        return json({
            collection: validated,
            url: `${env.SCREEN_LIBRARY_PUBLIC_URL.replace(/\/$/, '')}/collections/${id}/`,
        })
    if (request.method === 'POST' && action === 'capture') {
        if (!validated.missing.length) return json({ collection: validated, queued: false })
        let candidate = validated
        if (validated.capture?.status === 'running') {
            const startedAt = Date.parse(validated.capture.startedAt ?? '')
            if (!Number.isFinite(startedAt) || Date.now() - startedAt <= CAPTURE_STALE_AFTER_MS)
                return json({ collection: validated, queued: false })
            // The capture workflow has a 60-minute timeout. A longer-running
            // attempt is therefore treated as abandoned, but receives a new
            // attempt ID so a late completion cannot overwrite the retry.
            const recovered = {
                ...validated,
                capture: {
                    ...validated.capture,
                    status: 'failed',
                    failedAt: new Date().toISOString(),
                    reason: 'The previous capture attempt expired before completion.',
                },
            }
            await env.REPORTS.put(key, JSON.stringify(recovered), {
                httpMetadata: {
                    contentType: 'application/json',
                    cacheControl: 'private, max-age=10',
                },
            })
            const latest = await readJson(env.REPORTS, key)
            if (!latest) return error('Collection not found', 404)
            candidate = validateCollection(latest)
            if (!candidate.missing.length || candidate.capture?.status === 'complete')
                return json({ collection: candidate, queued: false })
            if (candidate.capture?.status === 'queued' || candidate.capture?.status === 'running')
                return json({ collection: candidate, queued: false })
        } else if (validated.capture?.status === 'queued') {
            const requestedAt = Date.parse(validated.capture.requestedAt ?? '')
            if (Number.isFinite(requestedAt) && Date.now() - requestedAt <= CAPTURE_STALE_AFTER_MS)
                return json({ collection: validated, queued: false })
            const recovered = {
                ...validated,
                capture: {
                    ...validated.capture,
                    status: 'failed',
                    failedAt: new Date().toISOString(),
                    reason: 'The queued capture expired before the workflow started.',
                },
            }
            await env.REPORTS.put(key, JSON.stringify(recovered), {
                httpMetadata: {
                    contentType: 'application/json',
                    cacheControl: 'private, max-age=10',
                },
            })
            const latest = await readJson(env.REPORTS, key)
            if (!latest) return error('Collection not found', 404)
            candidate = validateCollection(latest)
            if (!candidate.missing.length || candidate.capture?.status === 'complete')
                return json({ collection: candidate, queued: false })
            if (candidate.capture?.status === 'queued' || candidate.capture?.status === 'running')
                return json({ collection: candidate, queued: false })
        }
        const queued = await queueCapture(candidate, env)
        return json({ collection: queued, queued: true }, 202)
    }
    return error('Not found', 404)
}

export default {
    async fetch(request, env, ctx) {
        if (!['GET', 'POST'].includes(request.method))
            return new Response(JSON.stringify({ error: 'Method not allowed' }), {
                status: 405,
                headers: { ...responseHeaders, Allow: 'GET, POST' },
            })
        const authenticated = await actor(request, env, ctx)
        if (!authenticated) return error('Authentication required', 401)
        const url = new URL(request.url)
        try {
            if (request.method === 'GET' && url.pathname === '/v1/screens') return await screenSearch(url, env)
            if (request.method === 'POST' && url.pathname === '/v1/collections')
                return await createCollection(request, authenticated, env)
            const match = /^\/v1\/collections\/([a-z0-9-]+)(?:\/(capture))?$/.exec(url.pathname)
            if (match) return await collectionRoute(request, match[1], match[2], env)
            return error('Not found', 404)
        } catch (cause) {
            const message = cause instanceof Error ? cause.message : 'Collection service failed'
            return error(message, /Invalid|Unsupported|needs|too large/.test(message) ? 400 : 503)
        }
    },
}
