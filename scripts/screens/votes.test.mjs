import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, keyFor, scopeFor, UUID, IMAGE } from './votes-fixture.mjs'

const mutation = (scope, value, version, requestId = UUID()) => ({ scope, value, version, requestId })
const summary = (scopes) => ({ scopes })
const successVote = (result, scope, mine, version) => {
    assert.equal(result.status, 200)
    assert.deepEqual(result.data, { vote: { key: keyFor(scope), mine, version } })
}
const getSummaries = async (f, scopes, options) => {
    const result = await f.call('/votes/summary', summary(scopes), options)
    assert.equal(result.status, 200)
    assert.deepEqual(
        result.data.votes.map((vote) => vote.key),
        scopes.map(keyFor),
        'summary preserves requested order and duplicates'
    )
    return result.data.votes
}

test('a human sets, switches, repeats, and removes a vote with an advancing per-actor version', async () => {
    const f = fixture()
    try {
        const scope = f.scope
        const before = await getSummaries(f, [scope])
        assert.deepEqual(before, [{ key: keyFor(scope), up: 0, down: 0, mine: 0, version: 0 }])

        successVote(await f.call('/votes', mutation(scope, 1, 0)), scope, 1, 1)
        let [vote] = await getSummaries(f, [scope])
        assert.deepEqual(vote, { key: keyFor(scope), up: 1, down: 0, mine: 1, version: 1 })

        successVote(await f.call('/votes', mutation(scope, 1, 1)), scope, 1, 2)
        ;[vote] = await getSummaries(f, [scope])
        assert.deepEqual(vote, { key: keyFor(scope), up: 1, down: 0, mine: 1, version: 2 })

        successVote(await f.call('/votes', mutation(scope, -1, 2)), scope, -1, 3)
        ;[vote] = await getSummaries(f, [scope])
        assert.deepEqual(vote, { key: keyFor(scope), up: 0, down: 1, mine: -1, version: 3 })

        successVote(await f.call('/votes', mutation(scope, 0, 3)), scope, 0, 4)
        ;[vote] = await getSummaries(f, [scope])
        assert.deepEqual(vote, { key: keyFor(scope), up: 0, down: 0, mine: 0, version: 4 })
    } finally {
        f.sql.close()
    }
})

test('vote state and receipts are actor-scoped; exact scope dimensions stay separate', async () => {
    const report2 = 'reports/2026-10-14/pr-6/en/abc/run-1'
    const reportEs = 'reports/2026-10-14/pr-7/es-419/abc/run-1'
    const reportLarge = 'reports/2026-10-14/pr-8/en/abc/run-1'
    const reportImage = 'reports/2026-10-14/pr-9/en/abc/run-1'
    const reportComparison = 'reports/2026-10-14/pr-10/en/abc/run-1'
    const image2 = `${'b'.repeat(64)}.webp`
    const imageBefore = `${'c'.repeat(64)}.webp`
    const f = fixture({
        count: 2,
        manifestsByReportPath: {
            [report2]: {
                schema: 1,
                type: 'capture',
                locale: 'en',
                width: 393,
                height: 852,
                screens: [{ id: 'screen-0', image: IMAGE(0), status: 'captured' }],
            },
            [reportEs]: {
                schema: 1,
                type: 'capture',
                locale: 'es-419',
                width: 393,
                height: 852,
                screens: [{ id: 'screen-0', image: IMAGE(0), status: 'captured' }],
            },
            [reportLarge]: {
                schema: 1,
                type: 'capture',
                locale: 'en',
                width: 430,
                height: 932,
                screens: [{ id: 'screen-0', image: IMAGE(0), status: 'captured' }],
            },
            [reportImage]: {
                schema: 1,
                type: 'capture',
                locale: 'en',
                width: 393,
                height: 852,
                screens: [{ id: 'screen-0', image: image2, status: 'captured' }],
            },
            [reportComparison]: {
                schema: 1,
                type: 'comparison',
                locale: 'en',
                before: { locale: 'en', profile: '393x852', width: 393, height: 852 },
                after: { locale: 'en', profile: '393x852', width: 393, height: 852 },
                screens: [
                    {
                        id: 'screen-0',
                        name: 'Trusted',
                        before: { image: imageBefore, status: 'captured' },
                        after: { image: IMAGE(0), status: 'captured' },
                    },
                ],
            },
        },
    })
    try {
        const alice = { email: 'alice@example.com', name: 'Alice' }
        const bob = { email: 'bob@example.com', name: 'Bob' }
        const scope0 = scopeFor(0),
            scope1 = scopeFor(1)
        const requestId = UUID()
        const first = await f.call('/votes', mutation(scope0, 1, 0, requestId), { actor: alice })
        successVote(first, scope0, 1, 1)
        const bobSameRequest = await f.call('/votes', mutation(scope0, -1, 0, requestId), { actor: bob })
        successVote(bobSameRequest, scope0, -1, 1)
        assert.deepEqual(await getSummaries(f, [scope0, scope1], { actor: alice }), [
            { key: keyFor(scope0), up: 1, down: 1, mine: 1, version: 1 },
            { key: keyFor(scope1), up: 0, down: 0, mine: 0, version: 0 },
        ])
        assert.deepEqual(await getSummaries(f, [scope0], { actor: bob }), [
            { key: keyFor(scope0), up: 1, down: 1, mine: -1, version: 1 },
        ])

        const distinct = [
            { ...scope0, reportPath: report2 },
            { ...scope0, reportPath: reportEs, locale: 'es-419' },
            { ...scope0, reportPath: reportLarge, profile: '430x932' },
            { ...scope0, reportPath: reportImage, image: image2 },
            { ...scope0, reportPath: reportComparison, image: imageBefore, side: 'before' },
        ]
        assert.equal(new Set([scope0, ...distinct].map(keyFor)).size, 6)
        for (const [index, other] of distinct.entries()) {
            const written = await f.call('/votes', mutation(other, 1, 0), { actor: alice })
            assert.equal(
                written.status,
                200,
                `valid independent scope dimension ${index}: ${JSON.stringify(written.data)}`
            )
            successVote(written, other, 1, 1)
            const [state] = await getSummaries(f, [scope0, other], { actor: alice })
            assert.equal(state.key, keyFor(scope0))
            assert.equal(state.up, 1)
            assert.equal(
                (await getSummaries(f, [other], { actor: alice }))[0].version,
                1,
                `dimension ${index} is independently persisted`
            )
        }
    } finally {
        f.sql.close()
    }
})

test('same actor and UUID replay the durable accepted response; changed payload conflicts', async () => {
    const f = fixture()
    try {
        const requestId = UUID()
        const payload = mutation(f.scope, 1, 0, requestId)
        const first = await f.call('/votes', payload)
        successVote(first, f.scope, 1, 1)
        const tablesAfterCommit = f.counts()
        const replay = await f.call('/votes', payload)
        assert.equal(replay.status, 200)
        assert.deepEqual(replay.data, first.data)
        assert.deepEqual(f.counts(), tablesAfterCommit, 'replay creates no second vote or receipt')

        const changed = await f.call('/votes', { ...payload, value: -1 })
        assert.equal(changed.status, 409)
        assert.deepEqual(f.counts(), tablesAfterCommit)
        assert.deepEqual(await getSummaries(f, [f.scope]), [
            { key: keyFor(f.scope), up: 1, down: 0, mine: 1, version: 1 },
        ])
    } finally {
        f.sql.close()
    }
})

test('optional actorId marker detects an identity switch while preserving markerless clients', async () => {
    const f = fixture()
    try {
        const before = f.counts()
        const mismatch = await f.call(
            '/votes',
            { ...mutation(f.scope, 1, 0), actorId: 'bob@example.com' },
            {
                actor: { email: 'alice@example.com', name: 'Alice' },
            }
        )
        assert.equal(mismatch.status, 403)
        assert.deepEqual(f.counts(), before, 'mismatched actor marker causes no vote, trusted scope, or receipt write')

        const marked = await f.call(
            '/votes',
            { ...mutation(f.scope, 1, 0), actorId: 'alice@example.com' },
            {
                actor: { email: 'alice@example.com', name: 'Alice' },
            }
        )
        successVote(marked, f.scope, 1, 1)
        const markerless = await f.call('/votes', mutation(f.scope, -1, 0), {
            actor: { email: 'bob@example.com', name: 'Bob' },
        })
        successVote(markerless, f.scope, -1, 1)
    } finally {
        f.sql.close()
    }
})

test('stale writes and remove-then-revote ABA cannot pass expected-version CAS', async () => {
    const f = fixture()
    try {
        const scope = f.scope
        const initial = await f.call('/votes', mutation(scope, 1, 0))
        successVote(initial, scope, 1, 1)
        successVote(await f.call('/votes', mutation(scope, 0, 1)), scope, 0, 2)
        successVote(await f.call('/votes', mutation(scope, -1, 2)), scope, -1, 3)
        const before = f.counts()
        assert.equal((await f.call('/votes', mutation(scope, 1, 1))).status, 409)
        assert.deepEqual(f.counts(), before)
        assert.deepEqual(await getSummaries(f, [scope]), [{ key: keyFor(scope), up: 0, down: 1, mine: -1, version: 3 }])
    } finally {
        f.sql.close()
    }
})

test('concurrent same-version writes have one winner and no misleading loser effects', async () => {
    const f = fixture()
    try {
        const actor = { email: 'alice@example.com', name: 'Alice' }
        const attempts = await Promise.all(
            Array.from({ length: 12 }, (_, i) => f.call('/votes', mutation(f.scope, i % 2 ? 1 : -1, 0), { actor }))
        )
        assert.equal(attempts.filter((item) => item.status === 200).length, 1)
        assert.equal(attempts.filter((item) => item.status === 409).length, 11)
        const [state] = await getSummaries(f, [f.scope], { actor })
        assert.equal(state.version, 1)
        assert.equal(state.up + state.down, 1)
        const requests = f.sql.prepare('SELECT count(*) AS n FROM comment_requests').get().n
        // A different UUID on every stale attempt must not leave successful receipts.
        assert.equal(requests, 1)
    } finally {
        f.sql.close()
    }
})

test('seeded bounded operation model across 100 scopes and 12 actors preserves aggregate invariants', async () => {
    const f = fixture({ count: 100 })
    try {
        const scopes = Array.from({ length: 100 }, (_, i) => scopeFor(i))
        const actors = Array.from({ length: 12 }, (_, i) => ({ email: `actor${i}@example.com`, name: `Actor ${i}` }))
        const seed = 0x51c0ffee
        let state = seed
        const random = () => {
            state = (Math.imul(state, 1664525) + 1013904223) >>> 0
            return state
        }
        const selected = new Map(scopes.map((scope) => [keyFor(scope), new Map()]))
        // Workload: 100 screenshot scopes x 12 concurrent human actors, 1,200 bounded writes.
        for (const scope of scopes) {
            const writes = await Promise.all(
                actors.map((actor) => {
                    const value = [-1, 0, 1][random() % 3]
                    return f
                        .call('/votes', mutation(scope, value, 0), { actor })
                        .then((result) => ({ actor, value, result }))
                })
            )
            assert.ok(writes.every(({ result }) => result.status === 200))
            const owners = selected.get(keyFor(scope))
            for (const { actor, value } of writes) owners.set(actor.email, value)
        }
        const expected = (scope) => {
            const values = [...selected.get(keyFor(scope)).values()]
            return {
                key: keyFor(scope),
                up: values.filter((value) => value === 1).length,
                down: values.filter((value) => value === -1).length,
                mine: selected.get(keyFor(scope)).get(actors[0].email),
                version: 1,
            }
        }
        f.counters.queries = 0
        const actual = await getSummaries(f, scopes, { actor: actors[0] })
        assert.deepEqual(actual, scopes.map(expected), `deterministic model seed=${seed}`)
        assert.ok(f.counters.queries <= 1, `100-scope summary used ${f.counters.queries} D1 queries`)
        const duplicateBatch = await getSummaries(f, [scopes[3], scopes[3]], { actor: actors[0] })
        assert.deepEqual(duplicateBatch, [expected(scopes[3]), expected(scopes[3])])
        assert.equal(
            (await f.call('/votes/summary', summary(Array.from({ length: 101 }, () => scopes[0])))).status,
            400
        )
    } finally {
        f.sql.close()
    }
})

test('vote inputs, identity, origin, request type, limits, and missing anchors fail without writes', async () => {
    const f = fixture()
    try {
        const before = f.counts()
        const valid = mutation(f.scope, 1, 0)
        for (const value of ['1', true, null, [], {}, 2, -2])
            assert.equal((await f.call('/votes', { ...valid, value })).status, 400, `invalid value ${String(value)}`)
        for (const version of [-1, 1.1, Number.MAX_SAFE_INTEGER + 1, '0', null])
            assert.equal(
                (await f.call('/votes', { ...valid, version })).status,
                400,
                `invalid version ${String(version)}`
            )
        for (const requestId of ['not-a-uuid', [], 1, null])
            assert.equal((await f.call('/votes', { ...valid, requestId })).status, 400)
        assert.equal((await f.call('/votes', { ...valid, scope: { ...f.scope, image: 'bad.webp' } })).status, 400)
        assert.equal((await f.call('/votes', valid, { origin: 'https://attacker.example' })).status, 403)
        assert.equal((await f.call('/votes', valid, { contentType: 'text/plain' })).status, 415)
        assert.equal(
            (
                await f.call('/votes', undefined, {
                    rawBody: JSON.stringify(valid),
                    contentType: 'application/json',
                    noAccess: true,
                })
            ).status,
            401
        )
        assert.equal(
            (await f.call('/votes', valid, { actor: { email: 'bot@example.com', service_token_status: 'SERVICE' } }))
                .status,
            403
        )
        assert.equal(
            (await f.call('/votes', valid, { actor: { email: 'alice@example.com' }, requestAudience: 'wrong' })).status,
            401
        )

        const oversized = JSON.stringify({ ...valid, padding: 'x'.repeat(32769) })
        assert.equal((await f.call('/votes', undefined, { rawBody: oversized })).status, 413)
        const missing = { ...f.scope, screenId: 'not-in-manifest' }
        assert.equal((await f.call('/votes', mutation(missing, 1, 0))).status, 404)
        assert.deepEqual(f.counts(), before)
        for (const route of ['/votes', '/votes/summary']) {
            const result = await f.call(route, route.endsWith('summary') ? summary([f.scope]) : valid)
            assert.equal(result.headers.get('cache-control'), 'no-store')
        }
    } finally {
        f.sql.close()
    }
})

test('D1 batch interruption rolls back vote, trusted scope, and receipt; lost response replays', async () => {
    for (const boundary of [1, 2, 3, 4]) {
        const f = fixture()
        try {
            const before = f.counts()
            const payload = mutation(f.scope, 1, 0)
            f.env.failBatchAfter = boundary
            assert.equal(
                (await f.call('/votes', payload)).status,
                503,
                `injected failure after D1 statement ${boundary}`
            )
            delete f.env.failBatchAfter
            assert.deepEqual(f.counts(), before, `statement ${boundary} interruption has no partial effects`)
            successVote(await f.call('/votes', payload), f.scope, 1, 1)
        } finally {
            f.sql.close()
        }
    }

    const f = fixture()
    try {
        successVote(await f.call('/votes', mutation(f.scope, 1, 0)), f.scope, 1, 1)
        const second = mutation(f.scope, -1, 1)
        const batch = f.env.COMMENTS.batch
        f.env.COMMENTS.batch = (items) => {
            batch(items)
            throw new Error('synthetic response lost after D1 commit')
        }
        assert.equal((await f.call('/votes', second)).status, 503)
        f.env.COMMENTS.batch = batch
        successVote(await f.call('/votes', second), f.scope, -1, 2)
        assert.deepEqual(await getSummaries(f, [f.scope]), [
            { key: keyFor(f.scope), up: 0, down: 1, mine: -1, version: 2 },
        ])
    } finally {
        f.sql.close()
    }
})

test('historically verified scope metadata remains usable after the mutable manifest advances', async () => {
    const f = fixture()
    try {
        successVote(await f.call('/votes', mutation(f.scope, 1, 0)), f.scope, 1, 1)
        f.env.REPORTS.get = async () => ({ json: async () => ({ schema: 1, type: 'capture', screens: [] }) })
        successVote(await f.call('/votes', mutation(f.scope, -1, 1)), f.scope, -1, 2)
        assert.deepEqual(await getSummaries(f, [f.scope]), [
            { key: keyFor(f.scope), up: 0, down: 1, mine: -1, version: 2 },
        ])
    } finally {
        f.sql.close()
    }
})

test('vote totals stay unavailable during provider outages instead of returning an empty state', async () => {
    const f = fixture()
    try {
        const database = f.env.COMMENTS
        const before = f.counts()
        f.env.COMMENTS = undefined
        const missingDatabase = await f.call('/votes/summary', summary([f.scope]))
        assert.equal(missingDatabase.status, 503)
        assert.deepEqual(f.counts(), before)
        f.env.COMMENTS = database

        f.env.REPORTS.get = async () => {
            throw new Error('synthetic storage outage')
        }
        const failedVote = await f.call('/votes', mutation(f.scope, 1, 0))
        assert.equal(failedVote.status, 503)
        assert.deepEqual(f.counts(), before)

        f.env.REPORTS.get = async () => ({
            json: async () => {
                throw new Error('synthetic object read outage')
            },
        })
        assert.equal((await f.call('/votes/summary', summary([f.scope]))).status, 200)
        f.env.COMMENTS = undefined
        assert.equal((await f.call('/votes/summary', summary([f.scope]))).status, 503)
    } finally {
        f.sql.close()
    }
})
