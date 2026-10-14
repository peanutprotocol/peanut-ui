import { ApiError, authenticate } from './comments-auth.mjs'
import {
    UUID,
    fail,
    json,
    statement,
    first,
    all,
    scopeKey,
    parseScope,
    verifiedScope,
    input,
    version,
    mutation,
    replay,
} from './comments-shared.mjs'
import { votesFetch } from './votes.mjs'

function comment(row) {
    return {
        id: row.id,
        threadId: row.thread_id,
        body: row.body,
        author: { id: row.author_id, name: row.author_name },
        createdAt: row.created_at,
        editedAt: row.edited_at,
        version: row.version,
    }
}
async function thread(db, id) {
    const row = await first(db, 'SELECT * FROM comment_threads WHERE id = ?', [id])
    if (!row) fail(404, 'Thread not found')
    const root = await first(db, 'SELECT * FROM comments WHERE id = ?', [row.root_id])
    if (!root) fail(503, 'Comments unavailable')
    const count = await first(db, 'SELECT count(*) AS count FROM comments WHERE thread_id = ? AND is_root = 0', [id])
    return {
        id: row.id,
        version: row.version,
        resolved: !!row.resolved,
        scope: JSON.parse(row.scope_json),
        comment: comment(root),
        replyCount: count.count,
    }
}
function page(url, fallback, namespace) {
    const raw = url.searchParams.get('limit')
    const limit = raw === null ? fallback : /^\d+$/.test(raw) ? Number(raw) : NaN
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) fail(400, 'Invalid page limit')
    let cursor
    if (url.searchParams.has('cursor')) {
        const value = url.searchParams.get('cursor')
        try {
            if (!value || value.length > 4096 || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error()
            cursor = JSON.parse(atob(value.replaceAll('-', '+').replaceAll('_', '/')))
            if (
                cursor.n !== namespace ||
                !Number.isSafeInteger(cursor.t) ||
                cursor.t < 0 ||
                typeof cursor.i !== 'string' ||
                !UUID.test(cursor.i)
            )
                throw new Error()
        } catch {
            fail(400, 'Invalid page cursor')
        }
    }
    return { limit, cursor }
}
function nextCursor(rows, limit, namespace) {
    if (rows.length <= limit) return null
    const row = rows[limit - 1]
    return btoa(JSON.stringify({ n: namespace, t: row.created_at, i: row.id }))
        .replaceAll('+', '-')
        .replaceAll('/', '_')
        .replace(/=+$/, '')
}
const cursorClause = (cursor, direction) =>
    cursor ? ` AND (created_at ${direction} ? OR (created_at = ? AND id ${direction} ?))` : ''
const cursorValues = (cursor) => (cursor ? [cursor.t, cursor.t, cursor.i] : [])
function validBody(value) {
    if (typeof value !== 'string' || !value.trim() || [...value].length > 4000) fail(400, 'Invalid comment text')
    return value
}
export async function commentsFetch(request, env, ctx) {
    try {
        const url = new URL(request.url),
            path = url.pathname.slice('/screen-data/comments'.length)
        const user = await authenticate(request, env, ctx)
        if (path === '/me' && request.method === 'GET') {
            const { service: _, ...human } = user
            return json({ user: human })
        }
        const match = /^\/(threads|comments)\/([0-9a-f-]{36})(\/replies)?$/i.exec(path)
        const reading =
            request.method === 'GET' && (['/screen', '/feed'].includes(path) || (match?.[1] === 'threads' && !match[3]))
        const writing =
            (request.method === 'POST' &&
                (['/threads', '/counts', '/votes', '/votes/summary'].includes(path) ||
                    (match?.[1] === 'threads' && match[3]))) ||
            (request.method === 'PATCH' && match && !match[3])
        if (!reading && !writing) fail(405, 'Method not allowed')
        if (writing && user.service) fail(403, 'Human identity required')
        const data = writing ? await input(request, url.origin) : null
        const db = env.COMMENTS
        if (!db?.prepare || !db?.batch) fail(503, 'Comments unavailable')
        if (path === '/votes' || path === '/votes/summary') return await votesFetch(path, data, user, env)
        if (path === '/counts') {
            if (!Array.isArray(data.scopes) || data.scopes.length > 100) fail(400, 'Invalid screenshot scopes')
            const keys = data.scopes.map(parseScope).map(scopeKey)
            const rows = await all(
                db,
                'SELECT t.scope_key AS key, count(*) AS count FROM comment_threads t JOIN comments c ON c.thread_id = t.id WHERE t.scope_key IN (SELECT value FROM json_each(?)) GROUP BY t.scope_key',
                [JSON.stringify(keys)]
            )
            const counts = new Map(rows.map((row) => [row.key, row.count]))
            return json({ counts: keys.map((key) => ({ key, count: counts.get(key) ?? 0 })) })
        }
        if (path === '/screen') {
            const scope = parseScope(Object.fromEntries(url.searchParams)),
                key = scopeKey(scope),
                namespace = `screen:${key}`
            const { limit, cursor } = page(url, 20, namespace)
            const rows = await all(
                db,
                `WITH page AS (
                    SELECT * FROM comment_threads WHERE scope_key = ?${cursorClause(cursor, '<')}
                    ORDER BY created_at DESC, id DESC LIMIT ?
                )
                SELECT p.*, c.id AS comment_id, c.body, c.author_id, c.author_name,
                    c.created_at AS comment_created_at, c.edited_at, c.version AS comment_version,
                    (SELECT count(*) FROM comments reply WHERE reply.thread_id = p.id AND reply.is_root = 0) AS reply_count
                FROM page p LEFT JOIN comments c ON c.id = p.root_id
                ORDER BY p.created_at DESC, p.id DESC`,
                [key, ...cursorValues(cursor), limit + 1]
            )
            return json({
                threads: rows.slice(0, limit).map((row) => {
                    if (!row.comment_id) fail(503, 'Comments unavailable')
                    return {
                        id: row.id,
                        version: row.version,
                        resolved: !!row.resolved,
                        scope: JSON.parse(row.scope_json),
                        comment: comment({
                            ...row,
                            id: row.comment_id,
                            thread_id: row.id,
                            created_at: row.comment_created_at,
                            version: row.comment_version,
                        }),
                        replyCount: row.reply_count,
                    }
                }),
                nextCursor: nextCursor(rows, limit, namespace),
            })
        }
        if (path === '/feed') {
            const pr = url.searchParams.get('pr')
            if (pr !== null && (!/^[1-9]\d*$/.test(pr) || !Number.isSafeInteger(Number(pr))))
                fail(400, 'Invalid PR number')
            const namespace = `feed:${pr ?? ''}`,
                { limit, cursor } = page(url, 30, namespace)
            const rows = await all(
                db,
                `SELECT c.*, t.scope_json, t.resolved FROM comments c JOIN comment_threads t ON c.thread_id = t.id WHERE 1 = 1${pr ? ' AND c.pr_number = ?' : ''}${cursor ? ' AND (c.created_at < ? OR (c.created_at = ? AND c.id < ?))' : ''} ORDER BY c.created_at DESC, c.id DESC LIMIT ?`,
                [...(pr ? [Number(pr)] : []), ...cursorValues(cursor), limit + 1]
            )
            return json({
                items: rows
                    .slice(0, limit)
                    .map((row) => ({ ...comment(row), scope: JSON.parse(row.scope_json), resolved: !!row.resolved })),
                nextCursor: nextCursor(rows, limit, namespace),
            })
        }
        const id = match?.[2]
        if (id && !UUID.test(id)) fail(400, 'Invalid resource ID')
        if (reading && match) {
            const namespace = `thread:${id}`,
                { limit, cursor } = page(url, 30, namespace),
                root = await thread(db, id)
            const rows = await all(
                db,
                `SELECT * FROM comments WHERE thread_id = ? AND is_root = 0${cursorClause(cursor, '>')} ORDER BY created_at ASC, id ASC LIMIT ?`,
                [id, ...cursorValues(cursor), limit + 1]
            )
            return json({
                thread: root,
                replies: rows.slice(0, limit).map(comment),
                nextCursor: nextCursor(rows, limit, namespace),
            })
        }
        if (path === '/threads') {
            const text = validBody(data.body),
                scope = parseScope(data.scope),
                fingerprint = JSON.stringify(['create', scopeKey(scope), text])
            const prior = await replay(db, user, data.requestId, fingerprint)
            if (prior) return prior
            const trusted = await verifiedScope(env, scope),
                threadId = crypto.randomUUID(),
                commentId = crypto.randomUUID(),
                now = Date.now()
            const root = {
                id: commentId,
                threadId,
                body: text,
                author: { id: user.id, name: user.name },
                createdAt: now,
                editedAt: null,
                version: 0,
            }
            const response = {
                thread: { id: threadId, version: 0, resolved: false, scope: trusted, comment: root, replyCount: 0 },
            }
            const result = await mutation(db, user, data, fingerprint, response, [
                (guard, values) =>
                    statement(
                        db,
                        `INSERT INTO comment_threads (id, scope_key, scope_json, pr_number, root_id, created_at) SELECT ?, ?, ?, ?, ?, ? WHERE ${guard}`,
                        [
                            threadId,
                            scopeKey(scope),
                            JSON.stringify(trusted),
                            trusted.prNumber ?? null,
                            commentId,
                            now,
                            ...values,
                        ]
                    ),
                (guard, values) =>
                    statement(
                        db,
                        `INSERT INTO comments (id, thread_id, body, author_id, author_name, created_at, pr_number, is_root) SELECT ?, ?, ?, ?, ?, ?, ?, 1 WHERE ${guard}`,
                        [commentId, threadId, text, user.id, user.name, now, trusted.prNumber ?? null, ...values]
                    ),
            ])
            return json(result.data, result.replay ? 200 : 201)
        }
        if (request.method === 'POST' && match?.[3]) {
            const text = validBody(data.body),
                fingerprint = JSON.stringify(['reply', id, text])
            const prior = await replay(db, user, data.requestId, fingerprint)
            if (prior) return prior
            const parent = await thread(db, id)
            const commentId = crypto.randomUUID(),
                now = Date.now()
            const response = {
                comment: {
                    id: commentId,
                    threadId: id,
                    body: text,
                    author: { id: user.id, name: user.name },
                    createdAt: now,
                    editedAt: null,
                    version: 0,
                },
            }
            const result = await mutation(db, user, data, fingerprint, response, [
                (guard, values) =>
                    statement(
                        db,
                        `INSERT INTO comments (id, thread_id, body, author_id, author_name, created_at, pr_number, is_root) SELECT ?, ?, ?, ?, ?, ?, ?, 0 WHERE ${guard}`,
                        [commentId, id, text, user.id, user.name, now, parent.scope.prNumber ?? null, ...values]
                    ),
            ])
            return json(result.data, result.replay ? 200 : 201)
        }
        if (match?.[1] === 'comments') {
            const text = validBody(data.body),
                expected = version(data.version),
                fingerprint = JSON.stringify(['edit', id, text, expected])
            const prior = await replay(db, user, data.requestId, fingerprint)
            if (prior) return prior
            const row = await first(db, 'SELECT * FROM comments WHERE id = ?', [id])
            if (!row) fail(404, 'Comment not found')
            if (row.author_id !== user.id) fail(403, 'Only the author can edit')
            if (row.version !== expected) fail(409, 'Version conflict')
            const now = Date.now(),
                response = { comment: comment({ ...row, body: text, version: expected + 1, edited_at: now }) }
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
                            `UPDATE comments SET body = ?, version = version + 1, edited_at = ? WHERE id = ? AND version = ? AND author_id = ? AND ${guard}`,
                            [text, now, id, expected, user.id, ...values]
                        ),
                ],
                'EXISTS (SELECT 1 FROM comments WHERE id = ? AND version = ? AND author_id = ?)',
                [id, expected, user.id]
            )
            return json(result.data)
        }
        if (typeof data.resolved !== 'boolean') fail(400, 'Invalid resolution')
        const expected = version(data.version),
            fingerprint = JSON.stringify(['resolve', id, data.resolved, expected])
        const prior = await replay(db, user, data.requestId, fingerprint)
        if (prior) return prior
        const current = await thread(db, id)
        if (current.version !== expected) fail(409, 'Version conflict')
        const result = await mutation(
            db,
            user,
            data,
            fingerprint,
            { thread: { ...current, resolved: data.resolved, version: expected + 1 } },
            [
                (guard, values) =>
                    statement(
                        db,
                        `UPDATE comment_threads SET resolved = ?, version = version + 1 WHERE id = ? AND version = ? AND ${guard}`,
                        [Number(data.resolved), id, expected, ...values]
                    ),
            ],
            'EXISTS (SELECT 1 FROM comment_threads WHERE id = ? AND version = ?)',
            [id, expected]
        )
        return json(result.data)
    } catch (error) {
        return json(
            { error: error instanceof ApiError ? error.message : 'Comments unavailable' },
            error instanceof ApiError ? error.status : 503
        )
    }
}
