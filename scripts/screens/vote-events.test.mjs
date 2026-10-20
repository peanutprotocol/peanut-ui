import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fixture, manifestFor, scopeFor, UUID, REPORT } from './votes-fixture.mjs'

const vote = (scope, value, version, extra = {}) => ({ scope, value, version, requestId: UUID(), ...extra })
const events = (f) =>
    f.sql
        .prepare(
            'SELECT actor_id, actor_name, value, previous_value, pr_number FROM screen_vote_events ORDER BY created_at, rowid'
        )
        .all()
        .map((row) => ({ ...row }))
const feed = async (f, query = '') => {
    const result = await f.call(`/feed${query}`, undefined, { method: 'GET', contentType: null })
    assert.equal(result.status, 200, JSON.stringify(result.data))
    return result.data
}
function withClock(start = 1_000_000) {
    const original = Date.now
    let now = start
    Date.now = () => now++
    return () => (Date.now = original)
}

test('each accepted vote change logs one event with actor, previous choice and PR', async () => {
    const f = fixture()
    try {
        assert.equal((await f.call('/votes', vote(f.scope, 1, 0))).status, 200)
        assert.equal((await f.call('/votes', vote(f.scope, -1, 1))).status, 200)
        assert.equal((await f.call('/votes', vote(f.scope, 0, 2))).status, 200)
        assert.deepEqual(events(f), [
            { actor_id: 'alice@example.com', actor_name: 'Alice', value: 1, previous_value: 0, pr_number: 5 },
            { actor_id: 'alice@example.com', actor_name: 'Alice', value: -1, previous_value: 1, pr_number: 5 },
            { actor_id: 'alice@example.com', actor_name: 'Alice', value: 0, previous_value: -1, pr_number: 5 },
        ])
    } finally {
        f.sql.close()
    }
})

test('replays, stale versions, identity mismatches and unchanged choices never log an event', async () => {
    const f = fixture()
    try {
        const first = vote(f.scope, 1, 0)
        assert.equal((await f.call('/votes', first)).status, 200)
        assert.equal((await f.call('/votes', first)).status, 200, 'exact replay succeeds')
        assert.equal((await f.call('/votes', vote(f.scope, -1, 0))).status, 409, 'stale expected version')
        assert.equal(
            (await f.call('/votes', vote(f.scope, -1, 1, { actorId: 'mallory@example.com' }))).status,
            403,
            'identity marker mismatch'
        )
        assert.equal((await f.call('/votes', vote(f.scope, 1, 1))).status, 200, 'same choice bumps the revision')
        assert.equal(events(f).length, 1, 'only the first accepted change is activity')
    } finally {
        f.sql.close()
    }
})

test('an interrupted batch logs nothing and the replayed request logs exactly once', async () => {
    for (const boundary of [1, 2, 3, 4]) {
        const f = fixture()
        try {
            const payload = vote(f.scope, 1, 0)
            f.env.failBatchAfter = boundary
            assert.equal((await f.call('/votes', payload)).status, 503)
            delete f.env.failBatchAfter
            assert.equal(events(f).length, 0, `no event after an interruption at statement ${boundary}`)
            assert.equal((await f.call('/votes', payload)).status, 200)
            assert.equal((await f.call('/votes', payload)).status, 200)
            assert.equal(events(f).length, 1)
        } finally {
            f.sql.close()
        }
    }
})

test('the feed merges comments and vote events newest first under one cursor', async () => {
    const restore = withClock()
    const f = fixture({ count: 2 })
    try {
        const other = scopeFor(1)
        assert.equal((await f.call('/threads', { scope: f.scope, body: 'first', requestId: UUID() })).status, 201)
        assert.equal((await f.call('/votes', vote(f.scope, 1, 0))).status, 200)
        assert.equal((await f.call('/threads', { scope: other, body: 'second', requestId: UUID() })).status, 201)
        f.setIdentity({ email: 'bob@example.com', name: 'Bob' })
        assert.equal((await f.call('/votes', vote(other, -1, 0))).status, 200)
        assert.equal((await f.call('/votes', vote(other, 0, 1))).status, 200)

        const seen = []
        let cursor
        do {
            const page = await feed(f, `?limit=2${cursor ? `&cursor=${cursor}` : ''}`)
            assert.ok(page.items.length <= 2)
            seen.push(...page.items)
            cursor = page.nextCursor
        } while (cursor)
        assert.deepEqual(
            seen.map((item) => (item.kind === 'vote' ? `${item.actor.name} ${item.value}` : item.body)),
            ['Bob 0', 'Bob -1', 'second', 'Alice 1', 'first']
        )
        assert.deepEqual(
            seen.map((item) => item.createdAt),
            [...seen.map((item) => item.createdAt)].sort((a, b) => b - a)
        )
        const latest = seen[0]
        assert.equal(latest.kind, 'vote')
        assert.deepEqual(latest.actor, { id: 'bob@example.com', name: 'Bob' })
        assert.equal(latest.previousValue, -1)
        assert.equal(latest.scope.screenId, 'screen-1')
        assert.equal(latest.scope.name, 'Screen 1')
        assert.equal(seen.at(-1).kind, 'comment')
        assert.equal(new Set(seen.map((item) => item.id)).size, seen.length, 'no item repeats across pages')
    } finally {
        restore()
        f.sql.close()
    }
})

test('the PR feed filter applies to vote events and comments alike', async () => {
    const restore = withClock()
    const prSix = REPORT.replace('/pr-5/', '/pr-6/')
    const f = fixture({ manifestsByReportPath: { [prSix]: manifestFor(1) } })
    try {
        const sixScope = scopeFor(0, { reportPath: prSix })
        assert.equal((await f.call('/votes', vote(f.scope, 1, 0))).status, 200)
        assert.equal((await f.call('/votes', vote(sixScope, -1, 0))).status, 200)
        assert.equal((await f.call('/threads', { scope: sixScope, body: 'six', requestId: UUID() })).status, 201)
        const five = await feed(f, '?pr=5')
        assert.deepEqual(
            five.items.map((item) => [item.kind, item.scope.reportPath]),
            [['vote', REPORT]]
        )
        const six = await feed(f, '?pr=6')
        assert.deepEqual(
            six.items.map((item) => item.kind),
            ['comment', 'vote']
        )
        const firstPage = await feed(f, '?pr=6&limit=1')
        const rejected = await f.call(`/feed?pr=5&cursor=${firstPage.nextCursor}`, undefined, {
            method: 'GET',
            contentType: null,
        })
        assert.equal(rejected.status, 400, 'a cursor stays bound to its PR filter')
    } finally {
        restore()
        f.sql.close()
    }
})

test('the vote events migration is additive and idempotent', async () => {
    const f = fixture()
    try {
        assert.equal((await f.call('/votes', vote(f.scope, 1, 0))).status, 200)
        const before = f.counts()
        f.sql.exec(readFileSync(new URL('./worker/migrations/0003_vote_events.sql', import.meta.url), 'utf8'))
        assert.deepEqual(f.counts(), before)
        const plan = f.sql
            .prepare(
                'EXPLAIN QUERY PLAN SELECT id FROM screen_vote_events WHERE pr_number = ? ORDER BY created_at DESC, id DESC LIMIT 3'
            )
            .all(5)
        assert.ok(plan.some((row) => row.detail.includes('screen_vote_events_pr_feed')))
    } finally {
        f.sql.close()
    }
})
