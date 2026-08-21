#!/usr/bin/env node
// design-system lint counts (TASK-21446, DS 02).
// counts the five migration metrics on the current tree. the committed baseline
// (scripts/ds-lint-baseline.json) is the day-1 snapshot; CI ratchet mode
// (--check) fails when any count goes UP. counts only go down.
//
// usage:
//   node scripts/ds-lint-counts.mjs                  # human-readable table
//   node scripts/ds-lint-counts.mjs --json           # machine-readable
//   node scripts/ds-lint-counts.mjs --write-baseline # rewrite ds-lint-baseline.json
//   node scripts/ds-lint-counts.mjs --check          # exit 1 if any count > baseline

import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'src')
const BASELINE_PATH = join(ROOT, 'scripts', 'ds-lint-baseline.json')

// allowlist for every metric: image-generation surfaces render standalone html
// with no tailwind, raw values are the tool there, not debt. the ds showcase
// pages display the token source itself (colors, spacing, type ramp rendered
// programmatically from values), so raw values there are the feature. the
// /dev/devices harness sizes its panes from measured pixel values and keeps its
// chrome deliberately colorless, so the app inside the panes is what you judge.
const GLOBAL_ALLOW = ['components/og/', 'app/api/og/', 'ImageGeneration/', 'dev/ds/', 'dev/components/', 'dev/devices/']

// extra allowlist for raw-hex only: canvas/D3/mermaid surfaces paint
// programmatically.
const HEX_ALLOW = [
    'share-asset/', // canvas card renderer
    'Global/InvitesGraph/', // d3 force graph
    'dev/kyc-flows/', // mermaid theming
    'LandingPage/PioneerCard3D', // canvas 3d card
]

const HEX_RE = /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g
const INLINE_STYLE_RE = /style=\{\{/g
// stock tailwind text sizes that the text-h* scale replaces
const STOCK_TEXT_RE = /\btext-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)\b/g
const DS_TEXT_RE = /\btext-h(?:10|[1-9])\b/g
// stock tailwind palette colors — the DS palette is n-*, grey-*, purple-*,
// primary-*, secondary-* etc., so any stock-palette class in a view is non-DS
const STOCK_PALETTE_RE =
    /\b(?:bg|text|border|ring|fill|stroke|from|to|via)-(?:red|blue|gray|slate|zinc|neutral|stone|amber|lime|emerald|teal|cyan|sky|indigo|violet|fuchsia|rose|orange)-[0-9]{2,3}\b/g
// arbitrary-value tailwind classes, e.g. bg-[#fff], w-[13px], text-[11px]
const ARBITRARY_RE = /[a-z-]+-\[[^\]\s]+\]/g

function* walk(dir) {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
        if (e.name === 'node_modules' || e.name.startsWith('.')) continue
        const p = join(dir, e.name)
        if (e.isDirectory()) yield* walk(p)
        else yield p
    }
}

const files = []
for (const p of walk(SRC)) {
    if (!/\.(tsx|ts)$/.test(p) || p.endsWith('.test.tsx') || p.endsWith('.test.ts')) continue
    files.push({ path: relative(SRC, p), text: readFileSync(p, 'utf8') })
}

const allowed = (path, extra = []) => [...GLOBAL_ALLOW, ...extra].some((a) => path.includes(a))
const countMatches = (text, re) => (text.match(re) ?? []).length
const isTsx = (f) => f.path.endsWith('.tsx')
const isView = (f) => /(^|\/)page\.tsx$/.test(f.path) || /\.view\.tsx$/.test(f.path) || /View\.tsx$/.test(f.path)

const counts = {}
let rawHexFiles = 0
counts.rawHex = files
    .filter((f) => isTsx(f) && !allowed(f.path, HEX_ALLOW))
    .reduce((sum, f) => {
        const n = countMatches(f.text, HEX_RE)
        if (n > 0) rawHexFiles++
        return sum + n
    }, 0)
counts.rawHexFiles = rawHexFiles
counts.inlineStyle = files
    .filter((f) => isTsx(f) && !allowed(f.path))
    .reduce((sum, f) => sum + countMatches(f.text, INLINE_STYLE_RE), 0)
counts.stockTextSize = files
    .filter((f) => isTsx(f) && !allowed(f.path))
    .reduce((sum, f) => sum + countMatches(f.text, STOCK_TEXT_RE), 0)
counts.dsTextScale = files.filter((f) => isTsx(f)).reduce((sum, f) => sum + countMatches(f.text, DS_TEXT_RE), 0)
counts.nonDsClassesInViews = files
    .filter((f) => isView(f) && !allowed(f.path))
    .reduce((sum, f) => sum + countMatches(f.text, STOCK_PALETTE_RE) + countMatches(f.text, ARBITRARY_RE), 0)
counts.useSearchParamsFiles = files.filter((f) => /\buseSearchParams\b/.test(f.text)).length
counts.nuqsFiles = files.filter((f) => /from ['"]nuqs['"]/.test(f.text)).length

// dsTextScale and nuqsFiles are adoption counts (should go UP) — everything
// else is debt (must only go DOWN). the ratchet only enforces the debt keys.
const DEBT_KEYS = [
    'rawHex',
    'rawHexFiles',
    'inlineStyle',
    'stockTextSize',
    'nonDsClassesInViews',
    'useSearchParamsFiles',
]

const mode = process.argv[2] ?? ''
if (mode === '--json') {
    console.log(JSON.stringify(counts, null, 2))
} else if (mode === '--write-baseline') {
    // 4-space indent matches prettier (tabWidth 4) so a regen never fails the format gate
    writeFileSync(BASELINE_PATH, JSON.stringify(counts, null, 4) + '\n')
    console.log(`baseline written to ${relative(ROOT, BASELINE_PATH)}`)
    console.log(JSON.stringify(counts, null, 2))
} else if (mode === '--check') {
    const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
    // a missing key would compare as `count > undefined` = false and silently pass
    const missing = DEBT_KEYS.filter((k) => typeof baseline[k] !== 'number')
    if (missing.length) {
        console.error(`ds-lint ratchet: baseline is missing ${missing.join(', ')} — rerun with --write-baseline.`)
        process.exit(1)
    }
    const regressions = DEBT_KEYS.filter((k) => counts[k] > baseline[k])
    for (const k of DEBT_KEYS) {
        const delta = counts[k] - baseline[k]
        const tag = delta > 0 ? 'REGRESSION' : 'ok'
        console.log(`${tag.padEnd(11)} ${k.padEnd(22)} baseline=${baseline[k]} now=${counts[k]}`)
    }
    if (regressions.length) {
        console.error(`\nds-lint ratchet failed: ${regressions.join(', ')} went up. counts only go down.`)
        console.error('if the increase is intentional and reviewed, rerun with --write-baseline.')
        process.exit(1)
    }
    console.log('\nds-lint ratchet ok — no metric increased.')
} else if (mode !== '') {
    // a typo'd flag must not silently degrade the ratchet to a green no-op
    console.error(`unknown mode '${mode}' — use --json, --write-baseline, --check, or no flag.`)
    process.exit(1)
} else {
    console.log('design-system lint counts (src/, tests excluded)\n')
    console.log(
        `  raw hex in tsx            ${counts.rawHex} (across ${counts.rawHexFiles} files; canvas/D3/og allowlisted)`
    )
    console.log(`  inline style={{           ${counts.inlineStyle}`)
    console.log(`  stock text sizes          ${counts.stockTextSize} (vs ${counts.dsTextScale} text-h* scale uses)`)
    console.log(
        `  non-DS classes in views   ${counts.nonDsClassesInViews} (page.tsx/*View files: stock palette + arbitrary values)`
    )
    console.log(`  useSearchParams files     ${counts.useSearchParamsFiles} (vs ${counts.nuqsFiles} nuqs files)`)
}
