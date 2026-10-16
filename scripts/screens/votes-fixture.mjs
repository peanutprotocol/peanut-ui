import { DatabaseSync } from 'node:sqlite'
import { readFileSync, readdirSync } from 'node:fs'
import worker from './worker/index.mjs'

export const UUID = () => crypto.randomUUID()
export const IMAGE = (n = 0) => `${n.toString(16).padStart(64, 'a')}.webp`
export const REPORT = 'reports/2026-10-14/pr-5/en/abc/run-1'

export function scopeFor(n = 0, overrides = {}) {
    return {
        reportPath: REPORT,
        screenId: `screen-${n}`,
        locale: 'en',
        profile: '393x852',
        image: IMAGE(n),
        side: 'after',
        ...overrides,
    }
}

export function manifestFor(count = 1) {
    return {
        schema: 1,
        type: 'capture',
        locale: 'en',
        profile: 'en-393x852',
        width: 393,
        height: 852,
        screens: Array.from({ length: count }, (_, n) => ({
            id: `screen-${n}`,
            name: `Screen ${n}`,
            image: IMAGE(n),
            status: 'captured',
        })),
    }
}

export function fixture({
    count = 1,
    manifest = manifestFor(count),
    reportPath = REPORT,
    manifestsByReportPath = {},
} = {}) {
    const sql = new DatabaseSync(':memory:')
    sql.exec('PRAGMA foreign_keys = ON')
    const migrations = new URL('./worker/migrations/', import.meta.url)
    for (const name of readdirSync(migrations)
        .filter((file) => file.endsWith('.sql'))
        .sort())
        sql.exec(readFileSync(new URL(name, migrations), 'utf8'))

    const counters = { queries: 0 }
    const env = {
        SCREEN_LIBRARY_ACCESS_AUD: 'test',
        COMMENTS: {
            prepare(query) {
                let values = []
                const statement = {
                    bind(...next) {
                        values = next
                        return statement
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
                    _runForBatch() {
                        counters.queries++
                        return sql.prepare(query).run(...values)
                    },
                }
                return statement
            },
            batch(items) {
                sql.exec('BEGIN IMMEDIATE')
                try {
                    const results = []
                    for (let i = 0; i < items.length; i++) {
                        results.push(items[i]._runForBatch ? items[i]._runForBatch() : items[i].run())
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
                if (!key.endsWith('/manifest.json')) return null
                const requestedPath = key.slice(0, -'/manifest.json'.length)
                const value = requestedPath === reportPath ? manifest : manifestsByReportPath[requestedPath]
                return value ? { json: async () => value } : null
            },
        },
    }
    let identity = { email: 'alice@example.com', name: 'Alice' }
    let audience = 'test'
    let accessEnabled = true
    const ctx = {
        get access() {
            return accessEnabled ? { aud: audience, getIdentity: async () => identity } : undefined
        },
    }

    return {
        sql,
        counters,
        env,
        ctx,
        reportPath,
        scope: scopeFor(0),
        setIdentity(value) {
            identity = value
        },
        setAudience(value) {
            audience = value
        },
        setAccessEnabled(value) {
            accessEnabled = value
        },
        async call(
            path,
            body,
            {
                method = 'POST',
                origin = 'https://example.com',
                contentType = 'application/json',
                rawBody,
                actor = identity,
                requestAudience = audience,
                noAccess = !accessEnabled,
            } = {}
        ) {
            const headers = { Origin: origin }
            if (contentType) headers['Content-Type'] = contentType
            const request = new Request(`https://example.com/screen-data/comments${path}`, {
                method,
                headers,
                body: rawBody ?? (body === undefined ? undefined : JSON.stringify(body)),
            })
            const requestCtx = noAccess ? {} : { access: { aud: requestAudience, getIdentity: async () => actor } }
            const response = await worker.fetch(request, env, requestCtx)
            let data
            try {
                data = await response.json()
            } catch {
                data = null
            }
            return { status: response.status, headers: response.headers, data }
        },
        counts() {
            const tables = sql
                .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
                .all()
            return Object.fromEntries(
                tables.map(({ name }) => [name, sql.prepare(`SELECT count(*) AS n FROM "${name}"`).get().n])
            )
        },
    }
}

export const keyFor = (scope) =>
    JSON.stringify([scope.reportPath, scope.screenId, scope.locale, scope.profile, scope.image, scope.side])
