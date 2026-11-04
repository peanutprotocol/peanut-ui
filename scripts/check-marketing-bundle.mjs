#!/usr/bin/env node

// Fails when a marketing route's client JS carries a catalog it never renders.
// Run after `pnpm build`:   pnpm check:marketing-bundle [route ...]   (default: /)
//
// Markers (strings that survive minification, one per catalog):
// - "SKALE Explorer": viem's ~700-chain registry (`import * as … from 'viem/chains'`
//   or 'wagmi/chains'). Only the SKALE chain definitions carry it, and the app
//   supports no SKALE chain, so it is present only when the whole registry is.
// - "Bitfinex LEO Token": the token list in src/constants/token-details.json,
//   loaded through src/constants/token-registry.consts.ts. No other source has it.
//
// A route's client chunks are read from the build output: the root main files
// in build-manifest.json, plus the route's client-reference manifest (entry
// files and the chunks of every client component in its tree), plus every chunk
// named in the prerendered HTML and RSC payload when the route is static.
// Chunks behind a dynamic import() are not counted: they do not load with the page.
//
// --report prints each chunk with raw and gzip bytes.

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import { gzipSync } from 'node:zlib'

const MARKERS = [
    { marker: 'SKALE Explorer', catalog: 'viem chain registry' },
    { marker: 'Bitfinex LEO Token', catalog: 'token list (token-details.json)' },
]

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const nextDir = join(root, '.next')
const args = process.argv.slice(2)
const report = args.includes('--report')
const routes = args.filter((arg) => !arg.startsWith('--'))
if (routes.length === 0) routes.push('/')

function readJson(path) {
    return JSON.parse(readFileSync(path, 'utf8'))
}

/** `/` → `index`, `/qr-payments/brazil` → `qr-payments/brazil`. */
function routeDir(route) {
    return route === '/' ? '' : route.replace(/^\//, '')
}

function clientReferenceManifest(route) {
    const file = join(nextDir, 'server', 'app', routeDir(route), 'page_client-reference-manifest.js')
    if (!existsSync(file)) return undefined
    const sandbox = { globalThis: {} }
    sandbox.globalThis = sandbox
    vm.runInNewContext(readFileSync(file, 'utf8'), sandbox)
    return Object.values(sandbox.__RSC_MANIFEST ?? {})[0]
}

function prerenderedChunks(route) {
    const base = join(nextDir, 'server', 'app', route === '/' ? 'index' : routeDir(route))
    const chunks = new Set()
    for (const file of [`${base}.html`, `${base}.rsc`]) {
        if (!existsSync(file)) continue
        for (const match of readFileSync(file, 'utf8').matchAll(/static\/chunks\/[\w\-./~@%]+?\.js/g)) {
            chunks.add(match[0])
        }
    }
    return chunks
}

function routeChunks(route) {
    const chunks = new Set()
    const buildManifest = readJson(join(nextDir, 'build-manifest.json'))
    for (const file of buildManifest.rootMainFiles ?? []) chunks.add(file)

    const manifest = clientReferenceManifest(route)
    if (!manifest) throw new Error(`no client-reference manifest for ${route}; is it an app route, and was it built?`)
    for (const files of Object.values(manifest.entryJSFiles ?? {})) {
        for (const file of files) chunks.add(file)
    }
    for (const mod of Object.values(manifest.clientModules ?? {})) {
        for (const file of mod.chunks ?? []) {
            if (file.endsWith('.js')) chunks.add(file.replace(/^\/?_next\//, ''))
        }
    }
    for (const file of prerenderedChunks(route)) chunks.add(file)
    return [...chunks].filter((file) => file.endsWith('.js')).sort()
}

if (!existsSync(join(nextDir, 'build-manifest.json'))) {
    console.error('check-marketing-bundle: no .next/build-manifest.json — run `pnpm build` first.')
    process.exit(2)
}

let failed = false
for (const route of routes) {
    const chunks = routeChunks(route)
    let raw = 0
    let gz = 0
    const hits = []
    const rows = []
    for (const chunk of chunks) {
        const path = join(nextDir, decodeURIComponent(chunk))
        if (!existsSync(path)) continue
        const source = readFileSync(path)
        const size = source.length
        const gzSize = gzipSync(source).length
        raw += size
        gz += gzSize
        rows.push(`  ${chunk}  ${size} B raw / ${gzSize} B gz`)
        const text = source.toString('utf8')
        for (const { marker, catalog } of MARKERS) {
            if (text.includes(marker)) hits.push(`  ${chunk} contains "${marker}" (${catalog})`)
        }
    }
    console.log(`${route}: ${rows.length} client chunks, ${raw} B raw / ${gz} B gz`)
    if (report) console.log(rows.join('\n'))
    if (hits.length) {
        failed = true
        console.error(`${route}: FAIL — a marketing route ships a catalog it never renders:\n${hits.join('\n')}`)
    } else {
        console.log(`${route}: ok — no marker of ${MARKERS.map((m) => m.catalog).join(' or ')}`)
    }
}
process.exit(failed ? 1 : 0)
