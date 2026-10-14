import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { webcrypto } from 'node:crypto'
import { Buffer } from 'node:buffer'
import { DatabaseSync } from 'node:sqlite'
import worker from './worker/index.mjs'

const here = fileURLToPath(new URL('.', import.meta.url))
const migrationPath = resolve(here, 'worker/migrations/0001_comments.sql')
const email = 'alice@peanut.me'
const otherEmail = 'bob@peanut.me'
const imageBefore = `${'a'.repeat(64)}.webp`
const imageAfter = `${'b'.repeat(64)}.webp`
const otherImage = `${'c'.repeat(64)}.webp`
const reportPath = `reports/2026-10-14/pr-123/en/${'a'.repeat(40)}/run-1-1`
const otherReportPath = `reports/2026-10-14/pr-124/en/${'b'.repeat(40)}/run-1-1`

function d1For(db, counters, { failBatchAfter = null } = {}) {
    const statement = (sql) => {
        let values = []
        const prepared = {
            bind(...args) {
                values = args
                return prepared
            },
            first() {
                counters.databaseCalls += 1
                return db.prepare(sql).get(...values) ?? null
            },
            all() {
                counters.databaseCalls += 1
                return { results: db.prepare(sql).all(...values), success: true }
            },
            run() {
                counters.databaseCalls += 1
                const result = db.prepare(sql).run(...values)
                return { success: true, meta: { changes: result.changes, last_row_id: result.lastInsertRowid } }
            },
            _runForBatch() {
                const result = db.prepare(sql).run(...values)
                return { success: true, meta: { changes: result.changes, last_row_id: result.lastInsertRowid } }
            },
        }
        return prepared
    }

    return {
        prepare: statement,
        batch(statements) {
            db.exec('BEGIN IMMEDIATE')
            try {
                const results = []
                for (let i = 0; i < statements.length; i += 1) {
                    results.push(statements[i]._runForBatch())
                    if (failBatchAfter !== null && i + 1 === failBatchAfter) {
                        throw new Error('synthetic batch interruption')
                    }
                }
                db.exec('COMMIT')
                return results
            } catch (error) {
                db.exec('ROLLBACK')
                throw error
            }
        },
    }
}

function identity(emailAddress = email, name = 'Alice', overrides = {}) {
    return { email: emailAddress, name, ...overrides }
}

function contextFor(auth) {
    let access
    if (auth === 'human') {
        access = { aud: 'test-audience', getIdentity: async () => identity() }
    } else if (auth === 'other-human') {
        access = { aud: 'test-audience', getIdentity: async () => identity(otherEmail, 'Bob') }
    } else if (auth === 'service') {
        access = {
            aud: 'test-audience',
            getIdentity: async () => identity(email, 'Alice', { service_token_status: true }),
        }
    } else if (auth === 'missing') {
        access = undefined
    } else if (auth === 'failed') {
        access = {
            aud: 'test-audience',
            getIdentity: async () => {
                throw new Error('private auth detail')
            },
        }
    } else if (auth === 'wrong-audience') {
        access = { aud: 'wrong-audience', getIdentity: async () => identity() }
    } else if (auth === 'no-identity') {
        access = { aud: 'test-audience', getIdentity: async () => null }
    }
    return { access }
}

function makeFixture({
    auth = 'human',
    migrate = true,
    database = 'sqlite',
    failBatchAfter = null,
    manifests = {},
} = {}) {
    const db = new DatabaseSync(':memory:')
    db.exec('PRAGMA foreign_keys = ON')
    if (migrate) db.exec(readFileSync(migrationPath, 'utf8'))
    const counters = { databaseCalls: 0 }
    const comments = database === 'sqlite' ? d1For(db, counters, { failBatchAfter }) : database
    const manifest = (path) =>
        manifests[path] ?? {
            schema: 1,
            type: 'comparison',
            locale: 'en',
            reportPath: path,
            before: { locale: 'en', profile: '393x852', width: 393, height: 852, commit: 'a'.repeat(40) },
            after: { locale: 'en', profile: '393x852', width: 393, height: 852, commit: 'b'.repeat(40) },
            screens: [
                {
                    id: 'screen-home',
                    name: 'Home',
                    before: { image: imageBefore, status: 'captured' },
                    after: { image: imageAfter, status: 'captured' },
                    status: 'changed',
                },
                {
                    id: 'screen-settings',
                    name: 'Settings',
                    before: { image: otherImage, status: 'captured' },
                    after: { image: otherImage, status: 'captured' },
                    status: 'unchanged',
                },
            ],
        }
    const env = {
        COMMENTS: comments,
        SCREEN_LIBRARY_ACCESS_AUD: 'test-audience',
        SCREEN_LIBRARY_ACCESS_TEAM_DOMAIN: 'unit.cloudflareaccess.com',
        REPORTS: {
            async get(key) {
                const path = key.replace(/\/manifest\.json$/, '')
                if (Object.hasOwn(manifests, path) || [reportPath, otherReportPath].includes(path)) {
                    const value = manifest(path)
                    return { json: async () => value, text: async () => JSON.stringify(value), body: null }
                }
                return null
            },
        },
    }
    const ctx = contextFor(auth)
    return {
        db,
        counters,
        env,
        ctx,
        close() {
            db.close()
        },
    }
}

function scoped({
    path = reportPath,
    screenId = 'screen-home',
    locale = 'en',
    profile = '393x852',
    image = imageBefore,
    side = 'before',
} = {}) {
    return { reportPath: path, screenId, locale, profile, image, side }
}

function request(path, { method = 'GET', body, headers = {} } = {}) {
    const actualHeaders = new Headers(headers)
    if (body !== undefined && !actualHeaders.has('content-type')) {
        actualHeaders.set('content-type', 'application/json')
    }
    if (!actualHeaders.has('origin')) actualHeaders.set('origin', 'https://app.peanut.me')
    return new Request(`https://app.peanut.me${path}`, {
        method,
        headers: actualHeaders,
        body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    })
}

function base64url(value) {
    return Buffer.from(value).toString('base64url')
}

async function signAccessJwt(privateKey, claims, kid = 'fixture-key') {
    const header = { alg: 'RS256', typ: 'JWT', kid }
    const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`
    const signature = await webcrypto.subtle.sign(
        'RSASSA-PKCS1-v1_5',
        privateKey,
        new TextEncoder().encode(signingInput)
    )
    return `${signingInput}.${base64url(signature)}`
}

async function withJwksFetch({ teamDomain, jwks, failure }, action) {
    const priorFetch = globalThis.fetch
    const endpoint = `https://${teamDomain}/cdn-cgi/access/certs`
    globalThis.fetch = async (input) => {
        const url = input instanceof Request ? input.url : String(input)
        if (url !== endpoint) throw new Error(`unexpected test fetch: ${url}`)
        if (failure) throw new Error('private JWKS provider detail')
        return new Response(JSON.stringify(jwks), {
            status: 200,
            headers: { 'content-type': 'application/json' },
        })
    }
    try {
        return await action()
    } finally {
        globalThis.fetch = priorFetch
    }
}

function accessClaims(overrides = {}) {
    const now = Math.floor(Date.now() / 1000)
    return {
        iss: 'https://unit.cloudflareaccess.com',
        aud: 'test-audience',
        exp: now + 300,
        iat: now - 10,
        sub: 'fixture-access-subject',
        email: 'Alice@Peanut.Me',
        name: 'Alice',
        ...overrides,
    }
}

async function staticJwtRequest({
    claims = accessClaims(),
    teamDomain = 'unit.cloudflareaccess.com',
    signingKey,
    jwks,
    failure = false,
    alterSignature = false,
} = {}) {
    const fixture = makeFixture({ migrate: false })
    fixture.ctx = {}
    fixture.env.SCREEN_LIBRARY_ACCESS_TEAM_DOMAIN = teamDomain
    try {
        let token = await signAccessJwt(signingKey, claims)
        if (alterSignature) {
            const parts = token.split('.')
            const signature = parts[2]
            parts[2] = `${signature[0] === 'a' ? 'b' : 'a'}${signature.slice(1)}`
            token = parts.join('.')
        }
        const result = await withJwksFetch({ teamDomain, jwks, failure }, () =>
            call(fixture, '/screen-data/comments/me', { headers: { 'Cf-Access-Jwt-Assertion': token } })
        )
        return { ...result, databaseCalls: fixture.counters.databaseCalls }
    } finally {
        fixture.close()
    }
}

async function call(fixture, path, options) {
    const response = await worker.fetch(request(path, options), fixture.env, fixture.ctx)
    const text = await response.text()
    let json
    try {
        json = text ? JSON.parse(text) : null
    } catch {
        json = null
    }
    return { response, json, text }
}

async function createThread(
    fixture,
    { scope = scoped(), body = 'Looks good', requestId = crypto.randomUUID(), ...extra } = {}
) {
    return call(fixture, '/screen-data/comments/threads', {
        method: 'POST',
        body: { scope, body, requestId, ...extra },
    })
}

async function createReply(fixture, threadId, body, requestId = crypto.randomUUID()) {
    return call(fixture, `/screen-data/comments/threads/${threadId}/replies`, {
        method: 'POST',
        body: { body, requestId },
    })
}

test('authentication is checked before any database access on every route class', async (t) => {
    for (const [label, auth, expected] of [
        ['missing access context', 'missing', 401],
        ['wrong audience', 'wrong-audience', 401],
        ['missing identity', 'no-identity', 401],
    ]) {
        await t.test(label, async () => {
            const fixture = makeFixture({ auth, migrate: false })
            try {
                const result = await call(fixture, '/screen-data/comments/me')
                assert.equal(result.response.status, expected)
                assert.equal(fixture.counters.databaseCalls, 0)
            } finally {
                fixture.close()
            }
        })
    }
    await t.test('forgeable identity headers do not authenticate', async () => {
        const fixture = makeFixture({ auth: 'missing', migrate: false })
        try {
            const result = await call(fixture, '/screen-data/comments/me', {
                headers: { 'x-user-email': email, 'x-user-name': 'Alice' },
            })
            assert.equal(result.response.status, 401)
            assert.equal(fixture.counters.databaseCalls, 0)
        } finally {
            fixture.close()
        }
    })
    await t.test('provider failure is unavailable and sanitized', async () => {
        const fixture = makeFixture({ auth: 'failed', migrate: false })
        try {
            const result = await call(fixture, '/screen-data/comments/me')
            assert.equal(result.response.status, 503)
            assert.doesNotMatch(result.text, /private auth detail|credential|secret/i)
            assert.equal(fixture.counters.databaseCalls, 0)
        } finally {
            fixture.close()
        }
    })
    await t.test('service identity can read but cannot create', async () => {
        const fixture = makeFixture({ auth: 'service', migrate: false })
        try {
            const result = await call(fixture, '/screen-data/comments/threads', {
                method: 'POST',
                body: { scope: scoped(), body: 'No', requestId: crypto.randomUUID() },
            })
            assert.equal(result.response.status, 403)
            assert.equal(fixture.counters.databaseCalls, 0)
        } finally {
            fixture.close()
        }
    })
})

test('Static Assets JWT authentication verifies RS256 Access tokens and JWKS', async (t) => {
    const pair = await webcrypto.subtle.generateKey(
        {
            name: 'RSASSA-PKCS1-v1_5',
            modulusLength: 2048,
            publicExponent: new Uint8Array([1, 0, 1]),
            hash: 'SHA-256',
        },
        true,
        ['sign', 'verify']
    )
    const publicJwk = {
        ...(await webcrypto.subtle.exportKey('jwk', pair.publicKey)),
        kid: 'fixture-key',
        use: 'sig',
        alg: 'RS256',
    }
    const jwks = { keys: [publicJwk] }
    const assertRejected = (result, statuses = [401, 403]) => {
        assert.ok(
            statuses.includes(result.response.status),
            `unexpected status ${result.response.status}: ${result.text}`
        )
        assert.equal(result.databaseCalls, 0)
    }

    await t.test('valid verified claims return a normalized user', async () => {
        const result = await staticJwtRequest({ signingKey: pair.privateKey, jwks })
        assert.equal(result.response.status, 200)
        assert.deepEqual(result.json, {
            user: { id: 'alice@peanut.me', name: 'Alice', email: 'alice@peanut.me' },
        })
        assert.equal(result.databaseCalls, 0)
    })

    await t.test('wrong signature is rejected', async () => {
        const result = await staticJwtRequest({ signingKey: pair.privateKey, jwks, alterSignature: true })
        assertRejected(result)
    })

    for (const [label, claims] of [
        ['wrong issuer', accessClaims({ iss: 'https://attacker.example' })],
        ['wrong audience', accessClaims({ aud: 'another-audience' })],
        ['expired token', accessClaims({ exp: Math.floor(Date.now() / 1000) - 60 })],
    ]) {
        await t.test(label, async () => {
            const result = await staticJwtRequest({ signingKey: pair.privateKey, jwks, claims })
            assertRejected(result)
        })
    }

    await t.test('missing human email is rejected', async () => {
        const claims = accessClaims()
        delete claims.email
        const result = await staticJwtRequest({ signingKey: pair.privateKey, jwks, claims })
        assertRejected(result)
    })

    await t.test('service identity is rejected for human comments access', async () => {
        const result = await staticJwtRequest({
            signingKey: pair.privateKey,
            jwks,
            claims: accessClaims({ service_token_status: true }),
        })
        assertRejected(result)
    })

    await t.test('missing configured team cannot trust token self-declared issuer', async () => {
        const fixture = makeFixture({ migrate: false })
        fixture.ctx = {}
        delete fixture.env.SCREEN_LIBRARY_ACCESS_TEAM_DOMAIN
        try {
            const token = await signAccessJwt(pair.privateKey, accessClaims())
            const result = await withJwksFetch({ teamDomain: 'unit.cloudflareaccess.com', jwks }, () =>
                call(fixture, '/screen-data/comments/me', { headers: { 'Cf-Access-Jwt-Assertion': token } })
            )
            assert.ok([401, 403].includes(result.response.status))
            assert.equal(fixture.counters.databaseCalls, 0)
        } finally {
            fixture.close()
        }
    })

    await t.test('temporary JWKS failure is sanitized and unavailable', async () => {
        const teamDomain = 'jwks-failure.unit.cloudflareaccess.com'
        const claims = accessClaims({ iss: `https://${teamDomain}` })
        const result = await staticJwtRequest({
            signingKey: pair.privateKey,
            jwks,
            claims,
            teamDomain,
            failure: true,
        })
        assert.equal(result.response.status, 503)
        assert.doesNotMatch(result.text, /private JWKS provider detail|credential|secret/i)
        assert.equal(result.databaseCalls, 0)
    })
})

test('GET me returns normalized verified identity without database access', async () => {
    const fixture = makeFixture({ migrate: false })
    try {
        const result = await call(fixture, '/screen-data/comments/me')
        assert.equal(result.response.status, 200)
        assert.deepEqual(result.json, { user: { id: email, name: 'Alice', email } })
        assert.equal(fixture.counters.databaseCalls, 0)
    } finally {
        fixture.close()
    }
})

test('thread creation is anchored, idempotent, and authors come from verified identity', async () => {
    const fixture = makeFixture()
    try {
        const requestId = crypto.randomUUID()
        const first = await createThread(fixture, {
            requestId,
            body: '  Literal\nbody 🌱  ',
            author: { id: otherEmail, name: 'Forged' },
        })
        assert.equal(first.response.status, 201)
        assert.equal(first.json.thread.comment.body, '  Literal\nbody 🌱  ')
        assert.deepEqual(first.json.thread.comment.author, { id: email, name: 'Alice' })
        assert.equal(first.json.thread.version, 0)
        assert.equal(first.json.thread.resolved, false)
        assert.equal(first.json.thread.replyCount, 0)
        assert.match(first.json.thread.id, /^[0-9a-f-]{36}$/i)
        const replay = await createThread(fixture, { requestId, body: '  Literal\nbody 🌱  ' })
        assert.equal(replay.response.status, 200)
        assert.equal(replay.json.thread.id, first.json.thread.id)
        const conflict = await createThread(fixture, { requestId, body: 'different payload' })
        assert.equal(conflict.response.status, 409)
    } finally {
        fixture.close()
    }
})

test('scope validation rejects unknown anchors and mismatched images without mutation', async () => {
    const fixture = makeFixture()
    try {
        for (const invalid of [
            scoped({ path: 'private/report' }),
            scoped({ path: 'reports/pr-123/manifest.json' }),
            scoped({ image: otherImage }),
            scoped({ screenId: 'missing-screen' }),
            scoped({ side: 'middle' }),
        ]) {
            const result = await createThread(fixture, { scope: invalid })
            assert.ok(
                [400, 404].includes(result.response.status),
                `${JSON.stringify(invalid)} returned ${result.response.status}`
            )
        }
        const listing = await call(
            fixture,
            `/screen-data/comments/screen?${new URLSearchParams({ ...scoped(), image: imageBefore })}`
        )
        assert.equal(listing.response.status, 200)
        assert.deepEqual(listing.json.threads, [])
    } finally {
        fixture.close()
    }
})

test('same screenshot filename under distinct reports has separate discussions', async () => {
    const fixture = makeFixture({ manifests: { [otherReportPath]: undefined } })
    try {
        const first = await createThread(fixture, { scope: scoped() })
        const second = await createThread(fixture, { scope: scoped({ path: otherReportPath }) })
        assert.equal(first.response.status, 201)
        assert.equal(second.response.status, 201)
        assert.notEqual(first.json.thread.id, second.json.thread.id)
        assert.equal(first.json.thread.scope.reportPath, reportPath)
        assert.equal(second.json.thread.scope.reportPath, otherReportPath)
    } finally {
        fixture.close()
    }
})

test('screen listing and thread detail preserve newest-first roots and chronological replies', async () => {
    const fixture = makeFixture()
    try {
        const root1 = await createThread(fixture, { body: 'root 1' })
        const root2 = await createThread(fixture, { body: 'root 2' })
        const thread = root1.json.thread
        const reply1 = await createReply(fixture, thread.id, 'reply 1')
        const reply2 = await createReply(fixture, thread.id, 'reply 2')
        assert.equal(root1.response.status, 201)
        assert.equal(root2.response.status, 201)
        assert.equal(reply1.response.status, 201)
        assert.equal(reply2.response.status, 201)
        const listing = await call(fixture, `/screen-data/comments/screen?${new URLSearchParams(scoped())}`)
        assert.equal(listing.response.status, 200)
        assert.deepEqual(
            listing.json.threads.map((item) => item.id),
            [root2.json.thread.id, thread.id]
        )
        const detail = await call(fixture, `/screen-data/comments/threads/${thread.id}`)
        assert.equal(detail.response.status, 200)
        assert.equal(detail.json.thread.comment.body, 'root 1')
        assert.deepEqual(
            detail.json.replies.map((item) => item.body),
            ['reply 1', 'reply 2']
        )
        assert.equal(detail.json.thread.replyCount, 2)
    } finally {
        fixture.close()
    }
})

test('reply request replay is idempotent and changed replay payload conflicts', async () => {
    const fixture = makeFixture()
    try {
        const root = await createThread(fixture)
        const requestId = crypto.randomUUID()
        const first = await createReply(fixture, root.json.thread.id, 'reply', requestId)
        const replay = await createReply(fixture, root.json.thread.id, 'reply', requestId)
        const conflict = await createReply(fixture, root.json.thread.id, 'changed', requestId)
        assert.equal(first.response.status, 201)
        assert.equal(replay.response.status, 200)
        assert.equal(replay.json.comment.id, first.json.comment.id)
        assert.equal(conflict.response.status, 409)
    } finally {
        fixture.close()
    }
})

test('comment edits enforce ownership, optimistic versions, and edit replay', async () => {
    const fixture = makeFixture()
    try {
        const root = await createThread(fixture)
        const comment = root.json.thread.comment
        const originalContext = fixture.ctx
        fixture.ctx = contextFor('other-human')
        try {
            const forbidden = await call(fixture, `/screen-data/comments/comments/${comment.id}`, {
                method: 'PATCH',
                body: { body: 'hijack', version: 0, requestId: crypto.randomUUID() },
            })
            assert.equal(forbidden.response.status, 403)
        } finally {
            fixture.ctx = originalContext
        }
        const requestId = crypto.randomUUID()
        const edited = await call(fixture, `/screen-data/comments/comments/${comment.id}`, {
            method: 'PATCH',
            body: { body: 'edited', version: 0, requestId },
        })
        assert.equal(edited.response.status, 200)
        assert.equal(edited.json.comment.body, 'edited')
        assert.equal(edited.json.comment.version, 1)
        assert.ok(Number.isInteger(edited.json.comment.editedAt))
        const stale = await call(fixture, `/screen-data/comments/comments/${comment.id}`, {
            method: 'PATCH',
            body: { body: 'stale', version: 0, requestId: crypto.randomUUID() },
        })
        assert.equal(stale.response.status, 409)
        const replay = await call(fixture, `/screen-data/comments/comments/${comment.id}`, {
            method: 'PATCH',
            body: { body: 'edited', version: 0, requestId },
        })
        assert.equal(replay.response.status, 200)
        assert.equal(replay.json.comment.id, edited.json.comment.id)
        assert.equal(replay.json.comment.version, 1)
    } finally {
        fixture.close()
    }
})

test('any authenticated human teammate can resolve and reopen with version checks', async () => {
    const fixture = makeFixture()
    try {
        const root = await createThread(fixture)
        const originalContext = fixture.ctx
        fixture.ctx = contextFor('other-human')
        try {
            const resolved = await call(fixture, `/screen-data/comments/threads/${root.json.thread.id}`, {
                method: 'PATCH',
                body: { resolved: true, version: 0, requestId: crypto.randomUUID() },
            })
            assert.equal(resolved.response.status, 200)
            assert.equal(resolved.json.thread.resolved, true)
            assert.equal(resolved.json.thread.version, 1)
        } finally {
            fixture.ctx = originalContext
        }
        const reopened = await call(fixture, `/screen-data/comments/threads/${root.json.thread.id}`, {
            method: 'PATCH',
            body: { resolved: false, version: 1, requestId: crypto.randomUUID() },
        })
        assert.equal(reopened.response.status, 200)
        assert.equal(reopened.json.thread.resolved, false)
        assert.equal(reopened.json.thread.version, 2)
        const stale = await call(fixture, `/screen-data/comments/threads/${root.json.thread.id}`, {
            method: 'PATCH',
            body: { resolved: true, version: 1, requestId: crypto.randomUUID() },
        })
        assert.equal(stale.response.status, 409)
    } finally {
        fixture.close()
    }
})

test('feed pagination is newest-first and deterministic across equal timestamps', async () => {
    const fixture = makeFixture()
    try {
        const roots = []
        for (let i = 0; i < 4; i += 1) {
            const created = await createThread(fixture, { body: `root ${i}` })
            roots.push(created.json.thread)
        }
        const all = await call(fixture, '/screen-data/comments/feed?pr=123&limit=2')
        assert.equal(all.response.status, 200)
        assert.equal(all.json.items.length, 2)
        assert.ok(all.json.nextCursor)
        const next = await call(
            fixture,
            `/screen-data/comments/feed?pr=123&limit=2&cursor=${encodeURIComponent(all.json.nextCursor)}`
        )
        assert.equal(next.response.status, 200)
        assert.equal(next.json.items.length, 2)
        const ids = [...all.json.items, ...next.json.items].map((item) => item.id)
        assert.equal(new Set(ids).size, 4)
        assert.deepEqual(
            ids,
            [...ids].sort((a, b) => {
                const left = [...all.json.items, ...next.json.items].find((item) => item.id === a)
                const right = [...all.json.items, ...next.json.items].find((item) => item.id === b)
                return right.createdAt - left.createdAt || right.id.localeCompare(left.id)
            })
        )
        assert.equal(roots.length, 4)
    } finally {
        fixture.close()
    }
})

test('reply pagination always supplies the root and reaches all chronological replies', async () => {
    const fixture = makeFixture()
    try {
        const root = await createThread(fixture, { body: 'root' })
        for (let i = 0; i < 5; i += 1) await createReply(fixture, root.json.thread.id, `reply ${i}`)
        const first = await call(fixture, `/screen-data/comments/threads/${root.json.thread.id}?limit=2`)
        assert.equal(first.response.status, 200)
        assert.equal(first.json.thread.comment.body, 'root')
        assert.deepEqual(
            first.json.replies.map((reply) => reply.body),
            ['reply 0', 'reply 1']
        )
        const second = await call(
            fixture,
            `/screen-data/comments/threads/${root.json.thread.id}?limit=2&cursor=${encodeURIComponent(first.json.nextCursor)}`
        )
        assert.deepEqual(
            second.json.replies.map((reply) => reply.body),
            ['reply 2', 'reply 3']
        )
        const third = await call(
            fixture,
            `/screen-data/comments/threads/${root.json.thread.id}?limit=2&cursor=${encodeURIComponent(second.json.nextCursor)}`
        )
        assert.deepEqual(
            third.json.replies.map((reply) => reply.body),
            ['reply 4']
        )
        assert.equal(third.json.nextCursor, null)
    } finally {
        fixture.close()
    }
})

test('counts preserve request order and include roots, replies, and resolved threads', async () => {
    const fixture = makeFixture()
    try {
        const first = await createThread(fixture)
        await createReply(fixture, first.json.thread.id, 'reply')
        await call(fixture, `/screen-data/comments/threads/${first.json.thread.id}`, {
            method: 'PATCH',
            body: { resolved: true, version: 0, requestId: crypto.randomUUID() },
        })
        const secondScope = scoped({ screenId: 'screen-settings', image: otherImage })
        await createThread(fixture, { scope: secondScope })
        const result = await call(fixture, '/screen-data/comments/counts', {
            method: 'POST',
            body: { scopes: [scoped(), secondScope, scoped()] },
        })
        assert.equal(result.response.status, 200)
        assert.equal(result.json.counts.length, 3)
        assert.equal(result.json.counts[0].count, 2)
        assert.equal(result.json.counts[1].count, 1)
        assert.equal(result.json.counts[2].count, 2)
        assert.equal(result.json.counts[0].key, result.json.counts[2].key)
    } finally {
        fixture.close()
    }
})

test('request validation enforces origin, media type, limits, and Unicode code-point length', async () => {
    const fixture = makeFixture()
    try {
        const noOrigin = await call(fixture, '/screen-data/comments/threads', {
            method: 'POST',
            body: { scope: scoped(), body: 'x', requestId: crypto.randomUUID() },
            headers: { origin: '' },
        })
        assert.equal(noOrigin.response.status, 403)
        const foreignOrigin = await call(fixture, '/screen-data/comments/threads', {
            method: 'POST',
            body: { scope: scoped(), body: 'x', requestId: crypto.randomUUID() },
            headers: { origin: 'https://attacker.example' },
        })
        assert.equal(foreignOrigin.response.status, 403)
        const wrongType = await call(fixture, '/screen-data/comments/threads', {
            method: 'POST',
            body: JSON.stringify({ scope: scoped(), body: 'x', requestId: crypto.randomUUID() }),
            headers: { 'content-type': 'text/plain' },
        })
        assert.equal(wrongType.response.status, 415)
        const empty = await createThread(fixture, { body: ' \n\t ' })
        assert.equal(empty.response.status, 400)
        const fourThousandEmoji = await createThread(fixture, { body: '😀'.repeat(4000) })
        assert.equal(fourThousandEmoji.response.status, 201)
        const fourThousandOneEmoji = await createThread(fixture, { body: '😀'.repeat(4001) })
        assert.equal(fourThousandOneEmoji.response.status, 400)
        const oversize = await call(fixture, '/screen-data/comments/threads', {
            method: 'POST',
            body: `{"scope":${JSON.stringify(scoped())},"body":"${'x'.repeat(32769)}","requestId":"${crypto.randomUUID()}"}`,
        })
        assert.equal(oversize.response.status, 413)
    } finally {
        fixture.close()
    }
})

test('query limits, cursors, and PR values reject malformed inputs', async () => {
    const fixture = makeFixture()
    try {
        for (const query of ['limit=0', 'limit=51', 'limit=abc', 'cursor=not-a-cursor', 'pr=-1', 'pr=abc']) {
            const result = await call(fixture, `/screen-data/comments/feed?${query}`)
            assert.equal(result.response.status, 400, `${query} should be rejected`)
        }
        const tooMany = await call(fixture, '/screen-data/comments/counts', {
            method: 'POST',
            body: { scopes: Array.from({ length: 101 }, () => scoped()) },
        })
        assert.equal(tooMany.response.status, 400)
    } finally {
        fixture.close()
    }
})

test('atomic D1 batch failure leaves no partial thread or comment rows', async () => {
    const fixture = makeFixture({ failBatchAfter: 1 })
    try {
        const result = await createThread(fixture)
        assert.ok(result.response.status >= 500)
        assert.doesNotMatch(result.text, /synthetic batch interruption|SQLITE|credential|secret/i)
        const listing = await call(fixture, `/screen-data/comments/screen?${new URLSearchParams(scoped())}`)
        assert.equal(listing.response.status, 200)
        assert.deepEqual(listing.json.threads, [])
    } finally {
        fixture.close()
    }
})

test('missing and failing storage return sanitized unavailable responses', async () => {
    const missing = makeFixture({ database: null, migrate: false })
    try {
        const result = await call(missing, '/screen-data/comments/feed')
        assert.equal(result.response.status, 503)
        assert.doesNotMatch(result.text, /credential|secret|undefined/i)
    } finally {
        missing.close()
    }
    const failed = makeFixture({
        database: {
            prepare() {
                throw new Error('private database credential detail')
            },
            batch() {
                throw new Error('private database credential detail')
            },
        },
        migrate: false,
    })
    try {
        const result = await call(failed, '/screen-data/comments/feed')
        assert.equal(result.response.status, 503)
        assert.doesNotMatch(result.text, /private database credential detail|credential|secret/i)
    } finally {
        failed.close()
    }
})

test('unsupported methods and unknown routes have no side effects; API responses are no-store', async () => {
    const fixture = makeFixture()
    try {
        const before = fixture.counters.databaseCalls
        const method = await call(fixture, '/screen-data/comments/me', { method: 'DELETE' })
        assert.ok([404, 405].includes(method.response.status))
        const unknown = await call(fixture, '/screen-data/comments/unknown')
        assert.ok([404, 405].includes(unknown.response.status))
        assert.equal(fixture.counters.databaseCalls, before)
        const get = await call(fixture, '/screen-data/comments/me')
        assert.equal(get.response.headers.get('cache-control'), 'no-store')
    } finally {
        fixture.close()
    }
})
