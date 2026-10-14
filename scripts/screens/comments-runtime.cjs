// Manual real-workerd/D1 smoke: install isolated deploy dependencies, prepare and
// dry-run bundle the Worker, then pass its dist/index.js path. Synthetic data only.
const assert = require('node:assert/strict')
const { readFileSync, mkdtempSync, rmSync, writeFileSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join, resolve, dirname } = require('node:path')
const { generateKeyPairSync, sign, randomUUID, createHash } = require('node:crypto')
const { Miniflare } = require('./deploy/node_modules/miniflare')
const fixtureDir = mkdtempSync(join(tmpdir(), 'comments-real-d1-'))
const source = resolve(__dirname, '../..')
const bundle = resolve(process.argv[2] || '.screen-worker/dist/index.js')
const bundleSha256 = createHash('sha256').update(readFileSync(bundle)).digest('hex')
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'synthetic-local-smoke', alg: 'RS256', use: 'sig' }
const audience = 'test-audience'
const issuer = 'https://unit.cloudflareaccess.com'
const origin = 'https://screen-library.test'
let jwksRequests = 0
const reportPath = `reports/2026-10-14/pr-123/en/${'a'.repeat(40)}/run-1-1`
const image = `${'a'.repeat(64)}.webp`
const scope = { reportPath, screenId: 'screen-home', locale: 'en', profile: '393x852', image, side: 'after' }
const manifest = {
    schema: 1,
    type: 'capture',
    locale: 'en',
    profile: '393x852',
    width: 393,
    height: 852,
    screens: [{ id: 'screen-home', name: 'Home', image, status: 'captured' }],
}
function token(email = 'alice@example.test', expires = Math.floor(Date.now() / 1000) + 300) {
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: jwk.kid, typ: 'JWT' })).toString('base64url')
    const claims = Buffer.from(
        JSON.stringify({
            iss: issuer,
            aud: [audience],
            email,
            name: email.startsWith('alice') ? 'Alice' : 'Bob',
            exp: expires,
            iat: Math.floor(Date.now() / 1000),
        })
    ).toString('base64url')
    const payload = `${header}.${claims}`
    return `${payload}.${sign('RSA-SHA256', Buffer.from(payload), privateKey).toString('base64url')}`
}
function start() {
    return new Miniflare({
        modulesRoot: dirname(bundle),
        modules: true,
        scriptPath: bundle,
        compatibilityDate: '2026-09-11',
        d1Databases: { COMMENTS: 'synthetic-comments' },
        d1Persist: join(fixtureDir, 'd1'),
        r2Buckets: { REPORTS: 'synthetic-reports' },
        r2Persist: join(fixtureDir, 'r2'),
        bindings: {
            SCREEN_LIBRARY_ACCESS_AUD: audience,
            SCREEN_LIBRARY_ACCESS_TEAM_DOMAIN: 'unit.cloudflareaccess.com',
        },
        outboundService: async (request) => {
            assert.equal(request.url, `${issuer}/cdn-cgi/access/certs`, 'only pinned JWKS fetch is permitted')
            jwksRequests++
            return new Response(JSON.stringify({ keys: [jwk] }), { headers: { 'Content-Type': 'application/json' } })
        },
    })
}
let mf
let checks = 0
function ok(actual, expected, label) {
    assert.deepEqual(actual, expected, label)
    checks++
}
async function call(path, { method = 'GET', body, email, assertion = token(email), requestOrigin = origin } = {}) {
    const headers = { 'Cf-Access-Jwt-Assertion': assertion }
    if (body !== undefined) {
        headers['Content-Type'] = 'application/json'
        headers.Origin = requestOrigin
    }
    const response = await mf.dispatchFetch(`${origin}/screen-data/comments${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
    })
    const data = await response.json()
    assert.equal(response.headers.get('Cache-Control'), 'no-store')
    return { status: response.status, data }
}
;(async () => {
    try {
        mf = start()
        const db = await mf.getD1Database('COMMENTS')
        const migration = readFileSync(join(source, 'scripts/screens/worker/migrations/0001_comments.sql'), 'utf8')
        await db.batch(
            migration
                .replace(/^--.*$/gm, '')
                .split(';')
                .map((sql) => sql.trim())
                .filter(Boolean)
                .map((sql) => db.prepare(sql))
        )
        await (await mf.getR2Bucket('REPORTS')).put(`${reportPath}/manifest.json`, JSON.stringify(manifest))
        ok((await call('/me', { assertion: '' })).status, 401, 'missing signed identity fails')
        const me = await call('/me')
        ok([me.status, me.data.user.id], [200, 'alice@example.test'], 'jose verifies a signed JWT inside real workerd')
        const payload = { scope, body: 'Root <b>literal</b> 👋', requestId: randomUUID() }
        const created = await call('/threads', { method: 'POST', body: payload })
        ok(created.status, 201, 'D1 persists verified report anchor')
        const root = created.data.thread
        const replay = await call('/threads', { method: 'POST', body: payload })
        ok([replay.status, replay.data.thread.id], [200, root.id], 'D1 receipt replays the same resource')
        ok(
            (await call('/threads', { method: 'POST', body: { ...payload, body: 'different' } })).status,
            409,
            'request key cannot change payload'
        )
        const replied = await call(`/threads/${root.id}/replies`, {
            method: 'POST',
            email: 'bob@example.test',
            body: { body: 'Bob reply', requestId: randomUUID() },
        })
        ok(replied.status, 201, 'teammate reply persists')
        ok(
            (
                await call(`/comments/${root.comment.id}`, {
                    method: 'PATCH',
                    email: 'bob@example.test',
                    body: { body: 'forbidden', version: 0, requestId: randomUUID() },
                })
            ).status,
            403,
            'server enforces author-only editing'
        )
        const edit = await call(`/comments/${root.comment.id}`, {
            method: 'PATCH',
            body: { body: 'Edited root', version: 0, requestId: randomUUID() },
        })
        ok([edit.status, edit.data.comment.version], [200, 1], 'D1 conditional author edit increments version')
        ok(
            (
                await call(`/comments/${root.comment.id}`, {
                    method: 'PATCH',
                    body: { body: 'stale', version: 0, requestId: randomUUID() },
                })
            ).status,
            409,
            'stale edit cannot overwrite'
        )
        const resolve = await call(`/threads/${root.id}`, {
            method: 'PATCH',
            email: 'bob@example.test',
            body: { resolved: true, version: 0, requestId: randomUUID() },
        })
        ok(
            [resolve.status, resolve.data.thread.resolved, resolve.data.thread.version],
            [200, true, 1],
            'teammate resolves thread'
        )
        const counts = await call('/counts', { method: 'POST', body: { scopes: [scope] } })
        ok([counts.status, counts.data.counts[0].count], [200, 2], 'resolved root and reply remain counted')
        const reopened = await call(`/threads/${root.id}`, {
            method: 'PATCH',
            body: { resolved: false, version: 1, requestId: randomUUID() },
        })
        ok(
            [reopened.status, reopened.data.thread.resolved, reopened.data.thread.version],
            [200, false, 2],
            'teammate reopens thread'
        )
        const feed = await call('/feed?pr=123')
        ok([feed.status, feed.data.items.length], [200, 2], 'PR feed reads persisted messages')
        ok((await call('/feed?pr=124')).data.items.length, 0, 'another PR feed stays separate')
        const screen = await call('/screen?' + new URLSearchParams(scope))
        ok(
            [screen.status, screen.data.threads.length, screen.data.threads[0].replyCount],
            [200, 1, 1],
            'bounded screen listing works in actual D1'
        )
        const detail = await call(`/threads/${root.id}`)
        ok(
            [detail.status, detail.data.thread.comment.body, detail.data.replies[0].body],
            [200, 'Edited root', 'Bob reply'],
            'thread detail returns persisted edit and reply'
        )
        ok(
            (
                await call('/threads', {
                    method: 'POST',
                    requestOrigin: 'https://foreign.test',
                    body: { ...payload, requestId: randomUUID() },
                })
            ).status,
            403,
            'foreign Origin cannot write'
        )
        ok(
            (
                await call('/threads', {
                    method: 'POST',
                    body: { ...payload, scope: { ...scope, image: `${'b'.repeat(64)}.webp` }, requestId: randomUUID() },
                })
            ).status,
            400,
            'unverified image anchor cannot write'
        )
        ok((await call('/me', { assertion: token(undefined, 1) })).status, 401, 'expired JWT fails')
        const rows = await db
            .prepare(
                'SELECT (SELECT count(*) FROM comment_threads) AS threads, (SELECT count(*) FROM comments) AS messages, (SELECT count(*) FROM comment_requests) AS receipts'
            )
            .first()
        ok(rows, { threads: 1, messages: 2, receipts: 5 }, 'real D1 has no forbidden/partial side effects')
        await mf.dispose()
        mf = start()
        const afterRestart = await call(`/threads/${root.id}`)
        ok(
            [afterRestart.status, afterRestart.data.thread.comment.body, afterRestart.data.replies.length],
            [200, 'Edited root', 1],
            'real D1 persistence survives Worker restart'
        )
        ok(jwksRequests, 2, 'each Worker instance fetches only the pinned synthetic issuer')
        const result = {
            passed: true,
            checks,
            runtime: 'Miniflare workerd with actual D1/R2 bindings',
            syntheticIdentity: true,
            remoteCommentWrites: false,
            jwksRequests,
            bundle,
            bundleSha256,
            rows,
        }
        if (process.env.COMMENTS_RUNTIME_RECEIPT)
            writeFileSync(process.env.COMMENTS_RUNTIME_RECEIPT, JSON.stringify(result, null, 2))
        console.log(JSON.stringify(result, null, 2))
    } finally {
        if (mf) await mf.dispose()
        rmSync(fixtureDir, { recursive: true, force: true })
    }
})().catch((error) => {
    console.error(error)
    process.exitCode = 1
})
