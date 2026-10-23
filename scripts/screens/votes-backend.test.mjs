import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fixture, keyFor, scopeFor, UUID } from './votes-fixture.mjs'

const intent = (scope, value, version, requestId = UUID()) => ({ scope, value, version, requestId })
const tables = ['screen_votes', 'screen_vote_scopes', 'comment_requests']

test('each vote batch boundary rolls back all effects and preserves an existing neutral revision', async () => {
    for (const existing of [false, true]) {
        for (const boundary of [1, 2, 3]) {
            const f = fixture()
            try {
                if (existing) assert.equal((await f.call('/votes', intent(f.scope, 0, 0))).status, 200)
                const before = f.counts()
                const payload = intent(f.scope, 1, existing ? 1 : 0)
                f.env.failBatchAfter = boundary
                assert.equal((await f.call('/votes', payload)).status, 503)
                assert.deepEqual(f.counts(), before)
                if (existing) {
                    const state = await f.call('/votes/summary', { scopes: [f.scope] })
                    assert.equal(state.data.votes[0].mine, 0)
                    assert.equal(state.data.votes[0].version, 1)
                }
                delete f.env.failBatchAfter
                assert.equal((await f.call('/votes', payload)).status, 200)
            } finally {
                f.sql.close()
            }
        }
    }
})

test('100-scope ordered summaries use one SQL query, including duplicates and empty requests', async () => {
    const f = fixture({ count: 100 })
    try {
        const scopes = Array.from({ length: 100 }, (_, i) => scopeFor(99 - i))
        for (const batch of [scopes, [scopes[1], scopes[1], scopes[0]], []]) {
            const before = f.counters.queries
            const response = await f.call('/votes/summary', { scopes: batch })
            assert.equal(response.status, 200)
            assert.equal(f.counters.queries - before, 1)
            assert.deepEqual(
                response.data.votes.map((vote) => vote.key),
                batch.map(keyFor)
            )
        }
        f.env.COMMENTS.prepare = () => {
            throw new Error('private database fault')
        }
        const unavailable = await f.call('/votes/summary', { scopes })
        assert.equal(unavailable.status, 503)
        assert.deepEqual(unavailable.data, { error: 'Comments unavailable' })
        assert.equal(unavailable.headers.get('cache-control'), 'no-store')
    } finally {
        f.sql.close()
    }
})

test('replay precedes mutable anchor checks, namespaces receipt fingerprints, and trusts only manifest metadata', async () => {
    const f = fixture()
    try {
        const payload = intent({ ...f.scope, name: 'Untrusted', prNumber: 999 }, 1, 0)
        const original = await f.call('/votes', payload)
        assert.equal(original.status, 200)
        const trusted = JSON.parse(f.sql.prepare('SELECT scope_json FROM screen_vote_scopes').get().scope_json)
        assert.equal(trusted.name, 'Screen 0')
        assert.equal(trusted.prNumber, 5)
        const before = f.counts()
        const commentsConflict = await f.call('/threads', {
            scope: f.scope,
            body: 'cannot reuse vote UUID',
            requestId: payload.requestId,
        })
        assert.equal(commentsConflict.status, 409)
        assert.deepEqual(f.counts(), before)
        assert.equal((await f.call('/votes', intent(f.scope, 0, 1))).status, 200)
        f.env.REPORTS.get = () => {
            throw new Error('private missing historic manifest')
        }
        const replay = await f.call('/votes', payload)
        assert.equal(replay.status, 200)
        assert.deepEqual(replay.data, original.data)
        const bob = { email: 'bob@example.com' }
        assert.equal((await f.call('/votes', intent(f.scope, -1, 0), { actor: bob })).status, 200)
        const summary = await f.call('/votes/summary', { scopes: [f.scope] })
        assert.deepEqual(summary.data.votes, [{ key: keyFor(f.scope), up: 0, down: 1, mine: 0, version: 2 }])
    } finally {
        f.sql.close()
    }
})

test('seeded parser breadth rejects invalid dimensions, malformed JSON and coercions without writes', async () => {
    const f = fixture()
    try {
        const seed = 0x7007a11
        let state = seed
        const random = () => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0)
        const fields = ['reportPath', 'screenId', 'locale', 'profile', 'image', 'side']
        const bad = [null, [], {}, true, 0, '', '\u0000', '../private', '☃', 'x'.repeat(501)]
        const before = f.counts()
        for (let i = 0; i < 240; i++) {
            const field = fields[random() % fields.length]
            const scope = { ...f.scope, [field]: bad[random() % bad.length] }
            const result = await f.call('/votes', intent(scope, 1, 0))
            assert.equal(result.status, 400, `seed=${seed} operation=${i} field=${field}`)
        }
        for (const rawBody of ['{', 'null', '[]', 'true', '{"scopes":null}']) {
            assert.equal((await f.call('/votes/summary', undefined, { rawBody })).status, 400)
        }
        assert.deepEqual(f.counts(), before)
        for (const table of tables) assert.equal(before[table], 0)
    } finally {
        f.sql.close()
    }
})

test('additive vote migration replays without changing existing discussion rows', async () => {
    const f = fixture()
    try {
        const comment = await f.call('/threads', { scope: f.scope, body: 'retained comment', requestId: UUID() })
        assert.equal(comment.status, 201)
        assert.equal((await f.call('/votes', intent(f.scope, 1, 0))).status, 200)
        const before = f.counts()
        f.sql.exec(readFileSync(new URL('./worker/migrations/0002_votes.sql', import.meta.url), 'utf8'))
        assert.deepEqual(f.counts(), before)
        assert.equal(f.sql.prepare('SELECT body FROM comments').get().body, 'retained comment')
        const plan = f.sql
            .prepare('EXPLAIN QUERY PLAN SELECT value FROM screen_votes WHERE scope_key = ?')
            .all(keyFor(f.scope))
        assert.ok(plan.some((row) => row.detail.includes('screen_votes_scope_value')))
    } finally {
        f.sql.close()
    }
})
