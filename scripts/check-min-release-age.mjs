#!/usr/bin/env node
// Supply-chain freshness check.
//
// Why: protects against compromised npm packages that get caught and yanked
// within hours/days of publish. Policy: every dependency must be at least
// 14 days old before it can land in a Peanut repo.
//
// Usage (CI): node scripts/check-min-release-age.mjs --base <ref-package-json>
//   When --base is given, only deps that were added or had their version
//   spec changed are checked. Without --base, every direct dep is checked.
//
// Env knobs:
//   MIN_RELEASE_AGE_DAYS    floor in days (default 14)
//   MIN_RELEASE_AGE_EXCLUDE comma-separated package names to skip (emergency)
//   NPM_REGISTRY            registry base URL (default https://registry.npmjs.org)

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

const args = parseArgs(process.argv.slice(2))
const headPath = resolve(args.head ?? 'package.json')
const basePath = args.base ? resolve(args.base) : null
const repoRoot = dirname(headPath)

const MIN_AGE_DAYS = Number(process.env.MIN_RELEASE_AGE_DAYS ?? 14)
const MIN_AGE_MS = MIN_AGE_DAYS * 24 * 60 * 60 * 1000
const ALLOWLIST = new Set(
    (process.env.MIN_RELEASE_AGE_EXCLUDE ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
)
const REGISTRY = (process.env.NPM_REGISTRY ?? 'https://registry.npmjs.org').replace(/\/$/, '')
const CONCURRENCY = 10

const head = readPkg(headPath)
const headDeps = directDeps(head)

let candidates
if (basePath && existsSync(basePath)) {
    const base = readPkg(basePath)
    const baseDeps = directDeps(base)
    candidates = Object.keys(headDeps).filter((name) => headDeps[name] !== baseDeps[name])
    console.log(`comparing against base: ${candidates.length} added/changed dep(s)`)
} else {
    candidates = Object.keys(headDeps)
    console.log(`no base ref: checking all ${candidates.length} direct dep(s)`)
}

const targets = []
for (const name of candidates) {
    if (ALLOWLIST.has(name)) {
        console.log(`skip ${name}: on MIN_RELEASE_AGE_EXCLUDE allowlist`)
        continue
    }
    const installed = installedVersion(name)
    if (!installed) {
        console.warn(`warn ${name}: not installed (run install before this check)`)
        continue
    }
    targets.push({ name, version: installed })
}

if (!targets.length) {
    console.log('nothing to check')
    process.exit(0)
}

const violations = []
const queue = targets.slice()
await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
        while (queue.length) {
            const t = queue.shift()
            try {
                const publishedAt = await fetchPublishTime(t)
                const ageMs = Date.now() - publishedAt
                if (ageMs < MIN_AGE_MS) {
                    violations.push({ ...t, ageDays: (ageMs / 86_400_000).toFixed(1) })
                }
            } catch (err) {
                console.warn(`warn ${t.name}@${t.version}: ${err.message}`)
            }
        }
    })
)

if (violations.length) {
    console.error(`\n✗ ${violations.length} package(s) below the ${MIN_AGE_DAYS}-day floor:`)
    for (const v of violations.sort((a, b) => Number(a.ageDays) - Number(b.ageDays))) {
        console.error(`  ${v.name}@${v.version} — published ${v.ageDays} day(s) ago`)
    }
    console.error(`\nPolicy: dependencies must be ≥${MIN_AGE_DAYS} days old before install.`)
    console.error(`Emergency override: set MIN_RELEASE_AGE_EXCLUDE=pkg1,pkg2 in CI env.`)
    process.exit(1)
}

console.log(`✓ all ${targets.length} dep(s) meet the ≥${MIN_AGE_DAYS}-day age requirement`)

function parseArgs(argv) {
    const out = {}
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i]
        if (a === '--base') out.base = argv[++i]
        else if (a === '--head') out.head = argv[++i]
        else if (a.startsWith('--base=')) out.base = a.slice(7)
        else if (a.startsWith('--head=')) out.head = a.slice(7)
    }
    return out
}

function readPkg(path) {
    return JSON.parse(readFileSync(path, 'utf8'))
}

function directDeps(pkg) {
    return {
        ...pkg.dependencies,
        ...pkg.devDependencies,
        ...pkg.optionalDependencies,
    }
}

function installedVersion(name) {
    const manifest = join(repoRoot, 'node_modules', name, 'package.json')
    if (!existsSync(manifest)) return null
    return JSON.parse(readFileSync(manifest, 'utf8')).version
}

async function fetchPublishTime({ name, version }) {
    const url = `${REGISTRY}/${name.replace('/', '%2F')}`
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) throw new Error(`registry HTTP ${res.status}`)
    const body = await res.json()
    const ts = body.time?.[version]
    if (!ts) throw new Error(`no time entry for version ${version}`)
    return new Date(ts).getTime()
}
