import { ApiError, authenticate, bounded } from './comments-auth.mjs'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const FIELDS = ['reportPath', 'screenId', 'locale', 'profile', 'image', 'side']
const fail = (status, message) => {
    throw new ApiError(status, message)
}
const json = (data, status = 200) =>
    Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } })
const statement = (db, sql, values = []) => db.prepare(sql).bind(...values)
const first = (db, sql, values) => bounded(() => statement(db, sql, values).first())
const all = async (db, sql, values) => (await bounded(() => statement(db, sql, values).all())).results
const scopeKey = (scope) => JSON.stringify(FIELDS.map((field) => scope[field]))
function parseScope(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail(400, 'Invalid screenshot scope')
    const scope = Object.fromEntries(FIELDS.map((field) => [field, value[field]]))
    if (FIELDS.some((field) => typeof scope[field] !== 'string' || !scope[field] || scope[field].length > 500))
        fail(400, 'Invalid screenshot scope')
    if (
        !/^(?:reports\/[a-z0-9-]+(?:\/[a-z0-9-]+)*|collections\/[a-z0-9][a-z0-9-]{0,119})$/.test(scope.reportPath) ||
        !/^[a-zA-Z0-9_-]{1,120}$/.test(scope.screenId) ||
        !/^[a-zA-Z0-9-]{1,35}$/.test(scope.locale) ||
        !/^\d{2,4}x\d{2,4}$/.test(scope.profile) ||
        !/^[a-f0-9]{64}\.(?:webp|png)$/.test(scope.image) ||
        !['before', 'after'].includes(scope.side)
    )
        fail(400, 'Invalid screenshot scope')
    return scope
}
async function verifiedScope(env, value) {
    const scope = parseScope(value)
    if (!env.REPORTS?.get) fail(503, 'Report storage unavailable')
    let manifest
    try {
        const object = await bounded(() => env.REPORTS.get(`${scope.reportPath}/manifest.json`))
        if (!object) fail(404, 'Screenshot not found')
        if (object.size > 8 * 1024 * 1024) fail(400, 'Invalid report manifest')
        if (typeof object.text === 'function') {
            const text = await bounded(() => object.text())
            if (text.length > 8 * 1024 * 1024) fail(400, 'Invalid report manifest')
            manifest = JSON.parse(text)
        } else manifest = await bounded(() => object.json())
    } catch (error) {
        if (error instanceof ApiError) throw error
        fail(503, 'Report storage unavailable')
    }
    if (manifest?.schema !== 1) fail(400, 'Invalid report manifest')
    const collection = manifest.type === 'collection'
    const screen = (collection ? manifest.items : manifest.screens)?.find((entry) => entry.id === scope.screenId)
    if (!screen) fail(404, 'Screenshot not found')
    let image, locale, presentation
    if (manifest.type === 'comparison') {
        image = screen[scope.side]?.image
        presentation = manifest[scope.side]
        locale = presentation?.locale ?? manifest.locale
    } else if (collection) {
        if (scope.side !== 'after' || !manifest.locales?.includes(scope.locale)) fail(400, 'Invalid screenshot scope')
        image = screen.variants?.[scope.locale]?.image
        locale = scope.locale
        presentation = manifest
    } else if (['capture', 'journeys'].includes(manifest.type)) {
        if (scope.side !== 'after') fail(400, 'Invalid screenshot scope')
        image = screen.image
        locale = manifest.locale
        presentation = manifest
    } else fail(400, 'Invalid report manifest')
    const profile =
        Number.isInteger(presentation?.width) && Number.isInteger(presentation?.height)
            ? `${presentation.width}x${presentation.height}`
            : (presentation?.profile ?? (collection ? '393x852' : undefined))
    if (image !== scope.image || locale !== scope.locale || profile !== scope.profile)
        fail(400, 'Screenshot does not match report')
    const prMatch = /^reports\/[^/]+\/pr-([1-9]\d*)\//.exec(scope.reportPath)
    const prNumber = prMatch && Number.isSafeInteger(Number(prMatch[1])) ? Number(prMatch[1]) : null
    return {
        ...scope,
        name: typeof screen.name === 'string' ? screen.name.slice(0, 200) : screen.id,
        ...(prNumber ? { prNumber } : {}),
    }
}
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
async function input(request, origin) {
    if (request.headers.get('Origin') !== origin) fail(403, 'Same-origin request required')
    if (request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json')
        fail(415, 'JSON required')
    if (Number(request.headers.get('Content-Length')) > 32768) fail(413, 'Request too large')
    const reader = request.body?.getReader()
    const deadline = Date.now() + 5000
    let size = 0
    const chunks = []
    if (reader) {
        try {
            for (;;) {
                const remaining = deadline - Date.now()
                if (remaining <= 0) fail(503, 'Request unavailable')
                const { done, value } = await bounded(() => reader.read(), remaining)
                if (done) break
                size += value.byteLength
                if (size > 32768) {
                    void reader.cancel()
                    fail(413, 'Request too large')
                }
                chunks.push(value)
            }
        } finally {
            reader.releaseLock()
        }
    }
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) {
        bytes.set(chunk, offset)
        offset += chunk.byteLength
    }
    try {
        const value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error()
        return value
    } catch {
        fail(400, 'Invalid JSON')
    }
}
function validBody(value) {
    if (typeof value !== 'string' || !value.trim() || [...value].length > 4000) fail(400, 'Invalid comment text')
    return value
}
function version(value) {
    if (!Number.isSafeInteger(value) || value < 0) fail(400, 'Invalid version')
    return value
}
async function mutation(db, user, body, fingerprint, response, statements, condition = '', conditionValues = []) {
    if (typeof body.requestId !== 'string' || !UUID.test(body.requestId)) fail(400, 'Invalid request ID')
    const args = [user.id, body.requestId]
    const nonce = crypto.randomUUID()
    const guard = 'EXISTS (SELECT 1 FROM comment_requests WHERE actor_id = ? AND request_id = ? AND nonce = ?)'
    const guardValues = [...args, nonce]
    const receipt = statement(
        db,
        `INSERT INTO comment_requests (actor_id, request_id, fingerprint, nonce, response_json) SELECT ?, ?, ?, ?, ? ${condition ? `WHERE ${condition}` : ''} ON CONFLICT(actor_id, request_id) DO NOTHING`,
        [...args, fingerprint, nonce, JSON.stringify(response), ...conditionValues]
    )
    await bounded(() => db.batch([receipt, ...statements.map((build) => build(guard, guardValues))]))
    const saved = await first(db, 'SELECT * FROM comment_requests WHERE actor_id = ? AND request_id = ?', args)
    if (!saved) fail(409, 'Version conflict')
    if (saved.fingerprint !== fingerprint) fail(409, 'Request ID already used')
    return { data: JSON.parse(saved.response_json), replay: saved.nonce !== nonce }
}
// Replay precedes mutable version reads and collection manifest validation.
async function replay(db, user, requestId, fingerprint) {
    if (typeof requestId !== 'string' || !UUID.test(requestId)) fail(400, 'Invalid request ID')
    const existing = await first(db, 'SELECT * FROM comment_requests WHERE actor_id = ? AND request_id = ?', [
        user.id,
        requestId,
    ])
    if (!existing) return null
    if (existing.fingerprint !== fingerprint) fail(409, 'Request ID already used')
    return json(JSON.parse(existing.response_json))
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
                (['/threads', '/counts'].includes(path) || (match?.[1] === 'threads' && match[3]))) ||
            (request.method === 'PATCH' && match && !match[3])
        if (!reading && !writing) fail(405, 'Method not allowed')
        if (writing && user.service) fail(403, 'Human identity required')
        const data = writing ? await input(request, url.origin) : null
        const db = env.COMMENTS
        if (!db?.prepare || !db?.batch) fail(503, 'Comments unavailable')
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
