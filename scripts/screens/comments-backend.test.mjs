import test from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { readFileSync, readdirSync } from 'node:fs'
import worker from './worker/index.mjs'

// Generic SQL adapter: no query matching. All batches use SQLite transactions.
function fixture(manifest, reportPath = 'reports/2026-10-14/pr-5/en/abc/run-1') {
    const sql = new DatabaseSync(':memory:')
    sql.exec('PRAGMA foreign_keys = ON')
    const migrations = new URL('./worker/migrations/', import.meta.url)
    for (const name of readdirSync(migrations)
        .filter((file) => file.endsWith('.sql'))
        .sort())
        sql.exec(readFileSync(new URL(name, migrations), 'utf8'))
    const counters = { queries: 0 }
    function prepare(query) {
        let values = []
        const s = {
            bind(...next) {
                values = next
                return s
            },
            first() {
                counters.queries++
                return sql.prepare(query).get(...values) ?? null
            },
            all() {
                counters.queries++
                return { results: sql.prepare(query).all(...values) }
            },
            run() {
                counters.queries++
                return sql.prepare(query).run(...values)
            },
        }
        return s
    }
    const env = {
        SCREEN_LIBRARY_ACCESS_AUD: 'test',
        COMMENTS: {
            prepare,
            batch(items) {
                sql.exec('BEGIN IMMEDIATE')
                try {
                    const results = []
                    for (let i = 0; i < items.length; i++) {
                        results.push(items[i].run())
                        if (env.failBatchAfter === i + 1) throw new Error('private injected interruption')
                    }
                    sql.exec('COMMIT')
                    return results
                } catch (error) {
                    sql.exec('ROLLBACK')
                    throw error
                }
            },
        },
        REPORTS: {
            async get(key) {
                return key === `${reportPath}/manifest.json` ? { json: async () => manifest } : null
            },
        },
    }
    const ctx = { access: { aud: 'test', getIdentity: async () => ({ email: 'a@example.com', name: 'A' }) } }
    const scope = {
        reportPath,
        screenId: 'screen',
        locale: 'en',
        profile: '393x852',
        image: `${'a'.repeat(64)}.webp`,
        side: 'after',
    }
    return {
        sql,
        counters,
        env,
        ctx,
        scope,
        async call(path, body, method = body ? 'POST' : 'GET') {
            const request = new Request(`https://example.com/screen-data/comments${path}`, {
                method,
                headers: { Origin: 'https://example.com', 'Content-Type': 'application/json' },
                body: body ? JSON.stringify(body) : undefined,
            })
            const response = await worker.fetch(request, env, ctx)
            return { status: response.status, data: await response.json() }
        },
    }
}
const capture = () => ({
    schema: 1,
    type: 'capture',
    locale: 'en',
    profile: 'en-393x852',
    width: 393,
    height: 852,
    screens: [{ id: 'screen', name: 'Trusted', image: `${'a'.repeat(64)}.webp`, status: 'captured' }],
})

test('real manifest formats validate exact image, locale, presentation and side', async () => {
    const manifests = [
        capture(),
        { ...capture(), type: 'journeys', screens: [{ ...capture().screens[0], status: 'failed' }] },
        {
            schema: 1,
            type: 'collection',
            locales: ['en'],
            items: [
                {
                    id: 'screen',
                    name: 'Trusted',
                    variants: { en: { image: `${'a'.repeat(64)}.webp`, status: 'captured' } },
                },
            ],
        },
    ]
    for (const manifest of manifests) {
        const f = fixture(manifest, manifest.type === 'collection' ? 'collections/review' : undefined)
        try {
            assert.equal(
                (await f.call('/threads', { scope: f.scope, body: 'valid', requestId: crypto.randomUUID() })).status,
                201
            )
            for (const override of [
                { side: 'before' },
                { locale: 'es-AR' },
                { profile: '999x999' },
                { image: `${'b'.repeat(64)}.webp` },
            ])
                assert.ok(
                    [400, 404].includes(
                        (
                            await f.call('/threads', {
                                scope: { ...f.scope, ...override },
                                body: 'invalid',
                                requestId: crypto.randomUUID(),
                            })
                        ).status
                    )
                )
        } finally {
            f.sql.close()
        }
    }
})

test('concurrent duplicate creation and edits persist exactly one winning side effect', async () => {
    const f = fixture(capture())
    try {
        const payload = { scope: f.scope, body: 'root', requestId: crypto.randomUUID() }
        const creates = await Promise.all(Array.from({ length: 12 }, () => f.call('/threads', payload)))
        assert.equal(creates.filter((r) => r.status === 201).length, 1)
        assert.equal(new Set(creates.map((r) => r.data.thread.id)).size, 1)
        assert.equal(f.sql.prepare('SELECT count(*) AS n FROM comments').get().n, 1)
        const root = creates[0].data.thread
        const edits = await Promise.all(
            Array.from({ length: 12 }, (_, i) =>
                f.call(
                    `/comments/${root.comment.id}`,
                    { body: `edit ${i}`, version: 0, requestId: crypto.randomUUID() },
                    'PATCH'
                )
            )
        )
        assert.equal(edits.filter((r) => r.status === 200).length, 1)
        assert.equal(edits.filter((r) => r.status === 409).length, 11)
        assert.equal(f.sql.prepare('SELECT count(*) AS n FROM comment_requests').get().n, 2)
    } finally {
        f.sql.close()
    }
})

test('equal-time pagination traverses 80 roots/replies with page one', async () => {
    // Fixed workload: 40 numbered roots + 40 replies, concurrency 1; no randomness in operations.
    const f = fixture(capture())
    try {
        for (let i = 0; i < 40; i++) {
            const root = await f.call('/threads', { scope: f.scope, body: `root ${i}`, requestId: crypto.randomUUID() })
            await f.call(`/threads/${root.data.thread.id}/replies`, {
                body: `reply ${i}`,
                requestId: crypto.randomUUID(),
            })
        }
        f.sql.exec(
            'UPDATE comments SET created_at = 1770000000000; UPDATE comment_threads SET created_at = 1770000000000'
        )
        let cursor,
            seen = []
        do {
            const page = await f.call(`/feed?pr=5&limit=1${cursor ? `&cursor=${cursor}` : ''}`)
            assert.equal(page.status, 200)
            seen.push(...page.data.items.map((item) => item.id))
            cursor = page.data.nextCursor
        } while (cursor)
        assert.equal(seen.length, 80)
        assert.equal(new Set(seen).size, 80)
        assert.deepEqual(seen, [...seen].sort().reverse())
        const plan = f.sql
            .prepare(
                'EXPLAIN QUERY PLAN SELECT * FROM comments WHERE pr_number = ? ORDER BY created_at DESC, id DESC LIMIT ?'
            )
            .all(5, 2)
        assert.ok(plan.some((row) => row.detail.includes('comments_pr_feed_page')))
    } finally {
        f.sql.close()
    }
})

test('receipt replay survives later edits and mutable collection removal', async () => {
    const manifest = capture(),
        f = fixture(manifest)
    try {
        const requestId = crypto.randomUUID(),
            payload = { scope: f.scope, body: 'original', requestId }
        const root = await f.call('/threads', payload)
        await f.call(
            `/comments/${root.data.thread.comment.id}`,
            { body: 'edited', version: 0, requestId: crypto.randomUUID() },
            'PATCH'
        )
        manifest.screens = []
        const replay = await f.call('/threads', payload)
        assert.equal(replay.status, 200)
        assert.deepEqual(replay.data, root.data)
    } finally {
        f.sql.close()
    }
})

test('every thread batch interruption rolls back receipt and rows; unknown committed response replays', async () => {
    for (const index of [1, 2, 3]) {
        const f = fixture(capture())
        try {
            f.env.failBatchAfter = index
            const payload = { scope: f.scope, body: 'root', requestId: crypto.randomUUID() }
            assert.equal((await f.call('/threads', payload)).status, 503)
            for (const table of ['comment_threads', 'comments', 'comment_requests'])
                assert.equal(f.sql.prepare(`SELECT count(*) AS n FROM ${table}`).get().n, 0)
            delete f.env.failBatchAfter
            assert.equal((await f.call('/threads', payload)).status, 201)
        } finally {
            f.sql.close()
        }
    }
    const f = fixture(capture())
    try {
        const batch = f.env.COMMENTS.batch
        f.env.COMMENTS.batch = (items) => {
            batch(items)
            throw new Error('private response lost after commit')
        }
        const payload = { scope: f.scope, body: 'root', requestId: crypto.randomUUID() }
        assert.equal((await f.call('/threads', payload)).status, 503)
        f.env.COMMENTS.batch = batch
        assert.equal((await f.call('/threads', payload)).status, 200)
        assert.equal(f.sql.prepare('SELECT count(*) AS n FROM comments').get().n, 1)
    } finally {
        f.sql.close()
    }
})

test('actor-scoped request UUIDs do not replay another human resource', async () => {
    const f = fixture(capture())
    try {
        const payload = { scope: f.scope, body: 'root', requestId: crypto.randomUUID() }
        const alice = await f.call('/threads', payload)
        f.ctx.access.getIdentity = async () => ({ email: 'b@example.com', name: 'B' })
        const bob = await f.call('/threads', payload)
        assert.equal(bob.status, 201)
        assert.notEqual(alice.data.thread.id, bob.data.thread.id)
        assert.equal(
            (
                await f.call(
                    `/comments/${alice.data.thread.comment.id}`,
                    { body: 'forbidden', version: 0, requestId: crypto.randomUUID() },
                    'PATCH'
                )
            ).status,
            403
        )
    } finally {
        f.sql.close()
    }
})

test('malformed JSON field types reject without coercing identifiers into SQL bindings', async () => {
    const f = fixture(capture())
    try {
        for (const requestId of [[crypto.randomUUID()], {}, 1, true, null]) {
            assert.equal((await f.call('/threads', { scope: f.scope, body: 'root', requestId })).status, 400)
        }
        const cursor = btoa(JSON.stringify({ n: 'feed:', t: 1, i: [crypto.randomUUID()] }))
            .replaceAll('+', '-')
            .replaceAll('/', '_')
            .replace(/=+$/, '')
        assert.equal((await f.call(`/feed?cursor=${cursor}`)).status, 400)
        assert.equal(f.sql.prepare('SELECT count(*) AS n FROM comments').get().n, 0)
    } finally {
        f.sql.close()
    }
})

test('fifty-thread screen pages return roots and exact reply counts within two D1 queries', async () => {
    const f = fixture(capture())
    try {
        const roots = []
        for (let i = 0; i < 51; i++) {
            const result = await f.call('/threads', {
                scope: f.scope,
                body: `root ${i}`,
                requestId: crypto.randomUUID(),
            })
            roots.push(result.data.thread)
            for (let j = 0; j < i % 3; j++)
                await f.call(`/threads/${result.data.thread.id}/replies`, {
                    body: `reply ${j}`,
                    requestId: crypto.randomUUID(),
                })
        }
        const edited = await f.call(
            `/comments/${roots[0].comment.id}`,
            { body: 'edited root', version: 0, requestId: crypto.randomUUID() },
            'PATCH'
        )
        roots[0].comment = edited.data.comment
        const resolved = await f.call(
            `/threads/${roots[1].id}`,
            { resolved: true, version: 0, requestId: crypto.randomUUID() },
            'PATCH'
        )
        roots[1] = resolved.data.thread
        f.sql.exec('UPDATE comment_threads SET created_at = 1770000000000')
        const query = new URLSearchParams({ ...f.scope, limit: '50' })
        f.counters.queries = 0
        const page = await f.call(`/screen?${query}`)
        assert.equal(page.status, 200)
        assert.equal(page.data.threads.length, 50)
        assert.ok(page.data.nextCursor)
        assert.ok(f.counters.queries <= 2, `screen page used ${f.counters.queries} queries`)
        for (const item of page.data.threads) {
            const root = roots.find((candidate) => candidate.id === item.id)
            assert.deepEqual(item.comment, root.comment)
            assert.deepEqual(item.scope, root.scope)
            assert.equal(item.version, root.version)
            assert.equal(item.resolved, root.resolved)
            assert.equal(item.replyCount, roots.indexOf(root) % 3)
        }
        f.counters.queries = 0
        const last = await f.call(`/screen?${query}&cursor=${page.data.nextCursor}`)
        assert.equal(last.status, 200)
        assert.equal(last.data.threads.length, 1)
        assert.equal(last.data.nextCursor, null)
        assert.ok(f.counters.queries <= 2)
        assert.equal(new Set([...page.data.threads, ...last.data.threads].map((item) => item.id)).size, 51)
    } finally {
        f.sql.close()
    }
})
