#!/usr/bin/env node
/**
 * Sync `src/types/api.openapi.json` from a live BE OpenAPI spec.
 *
 * The BE is the source of truth (Fastify auto-generates /openapi.json from
 * route schemas). We snapshot it into FE for type generation. /dev/* paths
 * are test-mode-only on BE and stripped from the staging build, so we
 * preserve them from the existing FE snapshot — the harness needs them.
 *
 * Usage: node scripts/sync-openapi.mjs <live-spec-url> <fe-snapshot-path>
 *   e.g. node scripts/sync-openapi.mjs \
 *          https://api.staging.peanut.me/openapi.json \
 *          src/types/api.openapi.json
 */
import { readFile, writeFile } from 'node:fs/promises'

const [, , LIVE_URL, SNAPSHOT_PATH] = process.argv
if (!LIVE_URL || !SNAPSHOT_PATH) {
    console.error('Usage: sync-openapi.mjs <live-spec-url> <fe-snapshot-path>')
    process.exit(2)
}

const live = await fetch(LIVE_URL).then((r) => {
    if (!r.ok) throw new Error(`GET ${LIVE_URL} → HTTP ${r.status}`)
    return r.json()
})
const fe = JSON.parse(await readFile(SNAPSHOT_PATH, 'utf8'))

// Take live BE spec wholesale, then preserve /dev/* paths + their transitively
// referenced schemas from the existing FE snapshot.
const merged = structuredClone(live)
merged.paths ??= {}
merged.components ??= {}
merged.components.schemas ??= {}

const devPaths = Object.fromEntries(Object.entries(fe.paths ?? {}).filter(([p]) => p.startsWith('/dev')))
Object.assign(merged.paths, devPaths)

// Walk dev paths' schema $refs and copy them across (transitively).
const findRefs = (obj, refs = new Set()) => {
    if (!obj || typeof obj !== 'object') return refs
    if (Array.isArray(obj)) {
        for (const item of obj) findRefs(item, refs)
        return refs
    }
    for (const [k, v] of Object.entries(obj)) {
        if (k === '$ref' && typeof v === 'string' && v.startsWith('#/components/schemas/')) {
            refs.add(v.split('/').pop())
        } else {
            findRefs(v, refs)
        }
    }
    return refs
}
const feSchemas = fe.components?.schemas ?? {}
const beSchemas = merged.components.schemas
const visit = [...findRefs(devPaths)]
const seen = new Set()
while (visit.length) {
    const name = visit.pop()
    if (seen.has(name) || !(name in feSchemas) || name in beSchemas) continue
    seen.add(name)
    beSchemas[name] = feSchemas[name]
    visit.push(...findRefs(feSchemas[name]))
}

await writeFile(SNAPSHOT_PATH, JSON.stringify(merged, null, 2) + '\n')
console.log(`Synced ${Object.keys(merged.paths).length} paths to ${SNAPSHOT_PATH}`)
console.log(`  Live BE: ${Object.keys(live.paths ?? {}).length} paths`)
console.log(`  Preserved /dev/*: ${Object.keys(devPaths).length} paths`)
console.log(`  Carried-over schemas: ${seen.size}`)
