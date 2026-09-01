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
import {
    countOffScaleSpacing,
    countWeightStacks,
    OFF_SCALE_ICON_RE,
    OFF_SCALE_RADIUS_RE,
    RAW_DURATION_RE,
} from './ds-lint-rules.cjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'src')
const BASELINE_PATH = join(ROOT, 'scripts', 'ds-lint-baseline.json')

// allowlist for every metric: image-generation surfaces render standalone html
// with no tailwind, raw values are the tool there, not debt. the ds showcase
// pages display the token source itself (colors, spacing, type ramp rendered
// programmatically from values), so raw values there are the feature. the
// /dev/devices harness sizes its panes from measured pixel values and keeps its
// chrome deliberately colorless, so the app inside the panes is what you judge.
const GLOBAL_ALLOW = [
    'components/og/',
    'app/api/og/',
    'ImageGeneration/',
    'dev/ds/',
    'dev/components/',
    'dev/devices/',
    'dev/fixtures/', // fixture tooling incl. the on-camera banner — dev-only, DEV_TOOLS_ENABLED-gated
    'features/payment-network-explorer/', // team-gated /dev/payment-graph tool (same class as InvitesGraph) — not product UI
]

// extra allowlist for raw-hex only: canvas/D3/mermaid surfaces paint
// programmatically.
const HEX_ALLOW = [
    'share-asset/', // canvas card renderer
    'Global/InvitesGraph/', // d3 force graph
    'dev/kyc-flows/', // mermaid theming
    'LandingPage/PioneerCard3D', // canvas 3d card
    'receipt/[entryId]/pdf/', // @react-pdf/renderer — its StyleSheet takes no tailwind tokens
    'app/layout.tsx', // next viewport themeColor — browser chrome, must be a literal
]

// extra allowlist for inline-style only (F-12 taxonomy). canvas/D3/mermaid
// surfaces compute pixel styles programmatically; dev tooling pages are not
// product UI; the per-file keepers each hold a property tailwind has no
// utility for. everything NOT listed here is either a css-var/motion dynamic
// site (allowed to exist, still counted — the baseline is the floor) or debt.
const INLINE_STYLE_ALLOW = [
    'share-asset/', // canvas card renderer
    'Global/InvitesGraph/', // d3 force graph
    'dev/kyc-flows/', // mermaid theming
    'dev/journey/', // dev tooling
    'dev/full-graph/', // dev tooling
    'dev/payment-graph/', // dev tooling
    'dev/share-builder/', // dev tooling
    'dev/rejection-builder/', // dev tooling
    'dev/loading-words/', // dev tooling
    'app/layout.tsx', // colorScheme on <html> — must be a style prop
    '0_Bruddle/BaseSelect.tsx', // width from radix var(--radix-select-trigger-width)
    'qr-pay/page.tsx', // -webkit-touch-callout on the hold button — no utility
    'Global/ValidatedInput/', // -webkit tap-highlight/text-fill — no utility
]

const HEX_RE = /#[0-9a-fA-F]{8}\b|#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g
const INLINE_STYLE_RE = /style=\{\{/g
// stock tailwind text sizes that the text-h* scale replaces
const STOCK_TEXT_RE = /\btext-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)\b/g
const DS_TEXT_RE = /\btext-h(?:10|[1-9])\b/g
// stock tailwind families the DS does not define at all — any use in a view
// is non-DS. families the figma ramp owns (gray/pink/yellow/purple/blue/
// green/red/orange) are policed by offRampPalette below instead.
const STOCK_PALETTE_RE =
    /\b(?:bg|text|border|ring|fill|stroke|from|to|via)-(?:slate|zinc|neutral|stone|amber|lime|emerald|teal|cyan|sky|indigo|violet|fuchsia|rose)-[0-9]{2,3}\b/g
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
    .filter((f) => isTsx(f) && !allowed(f.path, INLINE_STYLE_ALLOW))
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

// legacy palette classes (phase-2 tier-2 kill list). semantic tokens
// (foreground-*, background-*, action-*, border-*) replaced these; anything
// still using them is either allowlisted (dev tooling, marketing/landing,
// og) or flagged in the phase-2 PR as having no semantic equivalent.
// no `shadow-` prefix: shadow-primary-4/6/8 + shadow-secondary-* are real
// offset-shadow utilities in globals.css, not palette classes. indices 1-11
// are the legacy palette; 50+ are the figma primitive ramp (gray-200 etc.),
// which is the design system, not debt.
const LEGACY_PALETTE_RE =
    /\b(?:bg|text|border|ring|fill|stroke|divide|outline|decoration|from|to|via)-(?:n|grey|gray|primary|purple|yellow|green|secondary|teal|violet|cyan|orange|success|error|blue|pink|red)-(?:[1-9]|1[01])\b/g
const LEGACY_ALLOW = [
    'components/LandingPage/',
    'components/Marketing/',
    'components/Jobs/',
    'app/lp/',
    'app/shhhhh/',
    'app/careers/',
    'app/jobs/',
    'app/m/',
    'app/[locale]/(marketing)/',
    '/dev/', // all dev tooling, not just dev/ds
]
counts.legacyColorClasses = files
    .filter((f) => isTsx(f) && !allowed(f.path, LEGACY_ALLOW))
    .reduce((sum, f) => sum + countMatches(f.text, LEGACY_PALETTE_RE), 0)

// ramp families with a non-figma index (gray-500, blue-400, pink-300, …).
// post-ramp these are silent holes (render nothing) or, if tailwind ever
// re-defines them, off-DS colors — either way debt, app-wide.
const RAMP_INDICES = {
    gray: [0, 50, 100, 200, 300, 400, 600, 700, 800, 900, 950],
    pink: [200, 500, 600, 700, 800],
    yellow: [200, 400, 500, 600, 900],
    purple: [200, 400, 500, 600],
    blue: [200, 300, 500, 600],
    green: [200, 400, 500, 800, 900],
    red: [50, 100, 200, 400, 500, 600],
    orange: [200, 400, 800],
}
const RAMP_FAMILY_RE =
    /\b(?:bg|text|border|ring|fill|stroke|divide|outline|decoration|from|to|via)-(gray|pink|yellow|purple|blue|green|red|orange)-([0-9]{2,3})\b/g
counts.offRampPalette = files
    .filter((f) => isTsx(f) && !allowed(f.path, LEGACY_ALLOW))
    .reduce((sum, f) => {
        let n = 0
        for (const m of f.text.matchAll(RAMP_FAMILY_RE)) {
            if (!RAMP_INDICES[m[1]].includes(Number(m[2]))) n++
        }
        return sum + n
    }, 0)

// dead-token metric, both directions (F-10 + Jota's inverse class):
// 1) deadLegacyTokens — a legacy-family --color token defined in globals.css
//    with zero class consumers anywhere in src. must stay 0: zero-consumer
//    shims get deleted, they cannot pile back up while marketing migrates.
// 2) consumedUndefinedTokens — a color-suffixed utility class whose token is
//    NOT in globals.css. in tailwind v4 an undefined token generates no
//    utility: the class silently vanishes from the compiled css (the
//    border-secondary-2 status-page bug). must stay 0, app-wide, no allowlist
//    — an invisible style is broken on marketing pages too.
const GLOBALS_CSS = readFileSync(join(SRC, 'styles', 'globals.css'), 'utf8')
const DEFINED_COLOR_TOKENS = new Set([...GLOBALS_CSS.matchAll(/--color-([a-z0-9-]+)\s*:/g)].map((m) => m[1]))
// families the theme owns (legacy palette + replaced-not-extended v4 scales);
// any <family>-<index> class outside DEFINED_COLOR_TOKENS is undefined.
const OWNED_FAMILIES = [
    'n',
    'grey',
    'gray',
    'primary',
    'secondary',
    'purple',
    'yellow',
    'green',
    'red',
    'blue',
    'pink',
    'orange',
    'teal',
    'violet',
    'cyan',
    'success',
    'error',
]
const LEGACY_FAMILIES = [
    'n',
    'grey',
    'primary',
    'secondary',
    'purple',
    'yellow',
    'green',
    'success',
    'error',
    'orange',
    'teal',
    'violet',
    'cyan',
]
const COLOR_CLASS_RE = new RegExp(
    '\\b(?:bg|text|border|ring|fill|stroke|divide|outline|decoration|from|to|via)-(' +
        OWNED_FAMILIES.join('|') +
        ')-([0-9]{1,3})\\b',
    'g'
)
// @apply rules inside globals.css consume tokens too (dark:bg-n-2 on body,
// bg-purple-3 etc.) — strip the --color definitions so they don't self-count.
const cssMinusDefs = GLOBALS_CSS.replace(/--color-[a-z0-9-]+\s*:[^;]+;/g, '')
const allSrcText = files.map((f) => f.text).join('\n') + '\n' + cssMinusDefs
const consumedBodies = new Set()
for (const m of allSrcText.matchAll(COLOR_CLASS_RE)) consumedBodies.add(`${m[1]}-${m[2]}`)
counts.deadLegacyTokens = [...DEFINED_COLOR_TOKENS].filter((t) => {
    const m = t.match(/^([a-z]+)-([1-9]|1[01])$/)
    return m && LEGACY_FAMILIES.includes(m[1]) && !consumedBodies.has(t)
}).length
const consumedOutsideAuditData = new Set()
for (const f of files) {
    // dev/ds/audit data files quote historical class names as strings — prose, not styling
    if (f.path.includes('dev/ds/audit/')) continue
    for (const m of f.text.matchAll(COLOR_CLASS_RE)) consumedOutsideAuditData.add(`${m[1]}-${m[2]}`)
}
for (const m of cssMinusDefs.matchAll(COLOR_CLASS_RE)) consumedOutsideAuditData.add(`${m[1]}-${m[2]}`)
counts.consumedUndefinedTokens = [...consumedOutsideAuditData].filter((b) => !DEFINED_COLOR_TOKENS.has(b)).length

// className sites in (mobile-ui) page.tsx files — pages should compose
// recipes/views, not respell utility strings. goes down as pages de-inline.
counts.classNameSitesInPages = files
    .filter((f) => /^app\/\(mobile-ui\)\//.test(f.path) && /(^|\/)page\.tsx$/.test(f.path) && !f.path.includes('/dev/'))
    .reduce((sum, f) => sum + countMatches(f.text, /className=/g), 0)

// composition-drift metrics (2026-09-01 sweep). design.md laws the token
// metrics above cannot see: stacked weights mint off-ramp type styles, the
// spacing/radius/motion scales ban off-scale values, icons have three sizes.
// deliberate holds (geometry-driven indents like Notification's pl-7, boards
// pending a ruling) live inside the baseline, not an allowlist — a ruling
// drives the count down, new drift pushes it up and fails.
counts.fontWeightOnTypeToken = files
    .filter((f) => isTsx(f) && !allowed(f.path))
    .reduce((sum, f) => sum + countWeightStacks(f.text), 0)
// matchers live in ds-lint-rules.cjs (imported at the top) so the regression
// tests in scripts/__tests__/ds-lint-rules.test.ts exercise the exact rules
// this script counts with, without running the src/ scan.
counts.offScaleSpacing = files
    .filter((f) => isTsx(f) && !allowed(f.path))
    .reduce((sum, f) => sum + countOffScaleSpacing(f.text), 0)
counts.iconOffScale = files
    .filter((f) => isTsx(f) && !allowed(f.path))
    .reduce((sum, f) => sum + countMatches(f.text, OFF_SCALE_ICON_RE), 0)
counts.offScaleRadius = files
    .filter((f) => isTsx(f) && !allowed(f.path))
    .reduce((sum, f) => sum + countMatches(f.text, OFF_SCALE_RADIUS_RE), 0)
counts.rawDuration = files
    .filter((f) => isTsx(f) && !allowed(f.path))
    .reduce((sum, f) => sum + countMatches(f.text, RAW_DURATION_RE), 0)

// dsTextScale and nuqsFiles are adoption counts (should go UP) — everything
// else is debt (must only go DOWN). the ratchet only enforces the debt keys.
const DEBT_KEYS = [
    'rawHex',
    'rawHexFiles',
    'inlineStyle',
    'stockTextSize',
    'nonDsClassesInViews',
    'useSearchParamsFiles',
    'legacyColorClasses',
    'offRampPalette',
    'classNameSitesInPages',
    'deadLegacyTokens',
    'consumedUndefinedTokens',
    'fontWeightOnTypeToken',
    'offScaleSpacing',
    'iconOffScale',
    'offScaleRadius',
    'rawDuration',
]

const mode = process.argv[2] ?? ''
if (mode === '--json') {
    console.log(JSON.stringify(counts, null, 2))
} else if (mode === '--write-baseline') {
    // a regen that RAISES a debt metric needs an explicit, visible reason —
    // this branch is how baseline bumps stopped being silent (F-14). CI only
    // ever runs --check, so the flag cannot be abused there.
    const allowIdx = process.argv.indexOf('--allow-increase')
    const allowReason = allowIdx !== -1 ? process.argv[allowIdx + 1] : null
    try {
        const prev = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
        const raised = DEBT_KEYS.filter((k) => typeof prev[k] === 'number' && counts[k] > prev[k])
        if (raised.length && !allowReason) {
            console.error(
                `--write-baseline would RAISE ${raised.map((k) => `${k} (${prev[k]} -> ${counts[k]})`).join(', ')}.`
            )
            console.error('debt only goes down. if this increase is reviewed and intentional, rerun with:')
            console.error('  --write-baseline --allow-increase "<why>"')
            process.exit(1)
        }
        if (raised.length) console.log(`baseline increase allowed: ${allowReason}`)
    } catch (e) {
        if (e.code !== 'ENOENT') throw e // no previous baseline: first write is free
    }
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
