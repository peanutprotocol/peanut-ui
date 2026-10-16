import { ApiError, bounded } from './comments-auth.mjs'

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

export {
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
}
