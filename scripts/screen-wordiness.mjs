#!/usr/bin/env node
// Screen wordiness budget. Counts the English copy each screen can show and
// ratchets it against scripts/screen-wordiness-baseline.json. Rules and
// rationale: scripts/screen-wordiness.md.
//
// usage:
//   node scripts/screen-wordiness.mjs                    # table of the heaviest screens
//   node scripts/screen-wordiness.mjs --check            # exit 1 on a regression
//   node scripts/screen-wordiness.mjs --update-baseline  # rewrite the baseline
//   node scripts/screen-wordiness.mjs --json             # every screen, machine-readable
//   flags: --top N (rows in the table, default 25), --budget N (with --update-baseline)

import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { measureScreens } = require('./screen-wordiness-core.cjs')

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const BASELINE_PATH = join(ROOT, 'scripts', 'screen-wordiness-baseline.json')
const DEFAULT_BUDGET = 60

const args = process.argv.slice(2)
const flagValue = (name, fallback) => {
    const i = args.indexOf(name)
    return i === -1 ? fallback : Number(args[i + 1])
}

const baseline = existsSync(BASELINE_PATH)
    ? JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
    : { budget: DEFAULT_BUDGET, screens: {} }
const screens = measureScreens(ROOT)

if (args.includes('--json')) {
    console.log(JSON.stringify(screens, null, 2))
    process.exit(0)
}

if (args.includes('--update-baseline')) {
    const budget = flagValue('--budget', baseline.budget ?? DEFAULT_BUDGET)
    const over = screens.filter((s) => s.words > budget).sort((a, b) => a.screen.localeCompare(b.screen))
    const next = {
        budget,
        screens: Object.fromEntries(over.map((s) => [s.screen, s.words])),
    }
    writeFileSync(BASELINE_PATH, JSON.stringify(next, null, 4) + '\n')
    console.log(`wrote ${BASELINE_PATH}: ${over.length} of ${screens.length} screens over the ${budget}-word budget`)
    process.exit(0)
}

const budget = baseline.budget ?? DEFAULT_BUDGET
const limitFor = (s) => Math.max(budget, baseline.screens[s.screen] ?? 0)
const regressions = screens.filter((s) => s.words > limitFor(s))
const improved = screens.filter((s) => baseline.screens[s.screen] !== undefined && s.words < baseline.screens[s.screen])
const measured = new Set(screens.map((s) => s.screen))
const stale = Object.keys(baseline.screens).filter((k) => !measured.has(k))

const topKeys = (s) => s.top.map((k) => `\`${k.key}\` ${k.words}`).join(', ')
const row = (s, i) => {
    const base = baseline.screens[s.screen]
    const delta = base === undefined ? 'new' : s.words === base ? '=' : `${s.words > base ? '+' : ''}${s.words - base}`
    return `| ${i} | \`${s.screen}\` | ${s.words} | ${base ?? '-'} | ${delta} | ${s.callouts} | ${topKeys(s)} |`
}
const table = (list) => [
    '| # | screen | score | baseline | Δ | callouts | heaviest keys |',
    '|--:|---|--:|--:|--:|--:|---|',
    ...list.map((s) => row(s, screens.indexOf(s) + 1)),
]

const top = flagValue('--top', 25)
const over = screens.filter((s) => s.words > budget).length
const lines = [
    '## Screen wordiness',
    '',
    `Budget: ${budget} per screen. Score = English words the screen can show; callout words count twice. ` +
        `${over} of ${screens.length} screens are over budget. Rules: \`scripts/screen-wordiness.md\`.`,
    '',
]
if (regressions.length) {
    lines.push(`### Failing: ${regressions.length} screen(s) over their limit`, '', ...table(regressions), '')
    lines.push(
        'A screen may not grow past its baseline entry, and a new screen may not exceed the budget. Cut copy, or — if the growth is deliberate — run `node scripts/screen-wordiness.mjs --update-baseline` and say why in the PR.',
        ''
    )
}
if (improved.length) {
    lines.push(
        `### ${improved.length} screen(s) below their baseline`,
        '',
        ...table(improved),
        '',
        'Lock the gain in: `node scripts/screen-wordiness.mjs --update-baseline`.',
        ''
    )
}
if (stale.length) {
    lines.push(`Baseline entries for screens that no longer exist: ${stale.map((s) => `\`${s}\``).join(', ')}.`, '')
}
lines.push(`### Top ${Math.min(top, screens.length)} heaviest screens`, '', ...table(screens.slice(0, top)), '')

const report = lines.join('\n')
console.log(report)
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, report + '\n')

if (args.includes('--check') && regressions.length) process.exit(1)
