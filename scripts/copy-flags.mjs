#!/usr/bin/env node
/**
 * Copies circle-flags SVGs from node_modules into public/flags/ so they're
 * served at /flags/<iso2>.svg. Runs on postinstall + before build. Idempotent.
 * `public/flags/` is gitignored — regenerated from the pinned npm dep.
 */
import { cpSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const src = resolve(root, 'node_modules/circle-flags/flags')
const dest = resolve(root, 'public/flags')

// circle-flags ships some flags under verbose filenames that don't match the
// ISO-2 / short codes the rest of the app uses. Mirror them under the short
// name we actually request. `countryCurrencyMapping.ts` maps EUR → 'eu'; the
// package only has 'european_union.svg', so without this alias every EUR-
// currency fallback (e.g. SEPA onramps without IBAN signal, the KYC icon
// strip) 404s in production.
//
// Several ISO-2 codes are also absent from circle-flags because they cover
// composite territories (BQ → Bonaire/Saba/Sint Eustatius, SH → Saint Helena/
// Ascension/Tristan) or uninhabited dependencies (BV, HM, SJ, UM). Without
// these aliases, `/flags/bq.svg` etc. 404 and the country list shows the
// generic UN fallback. Point each one at the closest meaningful flag the
// package ships — Bonaire for BQ, Saint Helena island for SH, and the parent
// country for the four dependencies.
const ALIASES = [
    ['european_union', 'eu'],
    ['bq-bo', 'bq'],
    ['sh-hl', 'sh'],
    ['no', 'bv'],
    ['no', 'sj'],
    ['au', 'hm'],
    ['us', 'um'],
]

if (!existsSync(src)) {
    console.error(`[copy-flags] source missing: ${src}. Run \`pnpm install\` first.`)
    process.exit(1)
}

mkdirSync(dest, { recursive: true })
cpSync(src, dest, { recursive: true })

for (const [from, to] of ALIASES) {
    const fromPath = resolve(src, `${from}.svg`)
    const toPath = resolve(dest, `${to}.svg`)
    if (!existsSync(fromPath)) {
        console.error(`[copy-flags] alias source missing: ${from}.svg`)
        process.exit(1)
    }
    cpSync(fromPath, toPath)
}

console.log(`[copy-flags] copied SVGs from circle-flags → public/flags/`)
