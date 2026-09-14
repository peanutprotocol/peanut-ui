// Answers an API call from the active fixture. Loaded lazily from api-fetch,
// behind DEV_TOOLS_ENABLED, so no reachable production code path runs it.
// (The chunk itself is still emitted — webpack creates one for every import()
// it finds in the source, dead branch or not. Same for /dev/devices.)

import { demoRespond } from '@/utils/demo-api'
import { FIXTURES } from './registry'
import { ensureActiveFixture } from './active'

const JSON_HEADERS = { 'content-type': 'application/json' }

let warned = false

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value)

/** Objects merge key by key. Arrays and primitives replace, so `[]` empties a list. */
function merge(base: unknown, patch: unknown): unknown {
    if (!isPlainObject(base) || !isPlainObject(patch)) return patch
    const out: Record<string, unknown> = { ...base }
    for (const [key, value] of Object.entries(patch)) out[key] = merge(out[key], value)
    return out
}

export async function fixtureRespond(path: string, options?: RequestInit): Promise<Response> {
    const name = ensureActiveFixture()
    const fixture = name ? FIXTURES[name] : undefined
    if (!fixture) {
        if (!warned) {
            warned = true
            console.error(
                `[fixtures] unknown fixture "${name}". Valid names:\n  ${Object.keys(FIXTURES).sort().join('\n  ')}`
            )
        }
        // Still serve the demo defaults — a wrong name must not hang the screen.
        return demoRespond(path, options)
    }

    const method = (options?.method ?? 'GET').toUpperCase()
    const key = `${method} ${path.split('?')[0].replace(/\/+$/, '')}`

    if (fixture.fails?.includes(key)) {
        return new Response(JSON.stringify({ error: 'fixture failure' }), { status: 500, headers: JSON_HEADERS })
    }

    // demo-api already answers every route the app calls, with a shape-aware
    // fallback for the rest. A fixture only says what differs from that.
    const base = await demoRespond(path, options)
    const override = fixture.responses?.[key]
    if (override === undefined) return base

    const data = await base.json().catch(() => ({}))
    return new Response(JSON.stringify(merge(data, override)), { status: base.status, headers: JSON_HEADERS })
}
