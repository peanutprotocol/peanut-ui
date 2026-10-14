import {
    all,
    fail,
    first,
    json,
    mutation,
    parseScope,
    replay,
    scopeKey,
    statement,
    verifiedScope,
    version,
} from './comments-shared.mjs'

export async function votesFetch(path, data, user, env) {
    const db = env.COMMENTS
    if (path === '/votes/summary') {
        if (!Array.isArray(data.scopes) || data.scopes.length > 100) fail(400, 'Invalid screenshot scopes')
        const keys = data.scopes.map(parseScope).map(scopeKey)
        const rows = await all(
            db,
            `SELECT scope_key AS key,
                sum(value = 1) AS up, sum(value = -1) AS down,
                max(CASE WHEN actor_id = ? THEN value END) AS mine,
                max(CASE WHEN actor_id = ? THEN version ELSE 0 END) AS version
             FROM screen_votes WHERE scope_key IN (SELECT value FROM json_each(?)) GROUP BY scope_key`,
            [user.id, user.id, JSON.stringify(keys)]
        )
        const summaries = new Map(rows.map((row) => [row.key, row]))
        return json({
            votes: keys.map((key) => {
                const row = summaries.get(key)
                return {
                    key,
                    up: row?.up ?? 0,
                    down: row?.down ?? 0,
                    mine: row?.mine ?? 0,
                    version: row?.version ?? 0,
                }
            }),
        })
    }
    // The browser binds a staged intent to its last verified human. A cookie may
    // change between /me and this request; the marker can only reject a mismatch.
    if (data.actorId !== undefined && data.actorId !== user.id) fail(403, 'Account changed before voting')
    if (typeof data.value !== 'number' || ![-1, 0, 1].includes(data.value)) fail(400, 'Invalid vote')
    const scope = parseScope(data.scope),
        key = scopeKey(scope),
        expected = version(data.version),
        fingerprint = JSON.stringify(['vote', key, data.value, expected])
    const prior = await replay(db, user, data.requestId, fingerprint)
    if (prior) return prior

    // A trusted historic anchor remains valid after a mutable collection advances.
    const known = await first(db, 'SELECT scope_key FROM screen_vote_scopes WHERE scope_key = ?', [key])
    const trusted = known ? null : await verifiedScope(env, scope)
    const response = { vote: { key, mine: data.value, version: expected + 1 } }
    const result = await mutation(
        db,
        user,
        data,
        fingerprint,
        response,
        [
            (guard, values) =>
                statement(
                    db,
                    `INSERT INTO screen_vote_scopes (scope_key, scope_json) SELECT ?, ? WHERE ${guard}
                     ON CONFLICT(scope_key) DO NOTHING`,
                    [key, JSON.stringify(trusted ?? scope), ...values]
                ),
            (guard, values) =>
                statement(
                    db,
                    `INSERT INTO screen_votes (actor_id, scope_key, value, version)
                     SELECT ?, ?, ?, ? WHERE ${guard}
                     ON CONFLICT(actor_id, scope_key) DO UPDATE SET value = excluded.value, version = excluded.version
                     WHERE screen_votes.version = ?`,
                    [user.id, key, data.value, expected + 1, ...values, expected]
                ),
        ],
        'coalesce((SELECT version FROM screen_votes WHERE actor_id = ? AND scope_key = ?), 0) = ?',
        [user.id, key, expected]
    )
    return json(result.data)
}
