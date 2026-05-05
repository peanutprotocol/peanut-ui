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

if (!existsSync(src)) {
    console.error(`[copy-flags] source missing: ${src}. Run \`pnpm install\` first.`)
    process.exit(1)
}

mkdirSync(dest, { recursive: true })
cpSync(src, dest, { recursive: true })
console.log(`[copy-flags] copied SVGs from circle-flags → public/flags/`)
