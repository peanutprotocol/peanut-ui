#!/usr/bin/env node
// i18n length drift (advisory). Flags app messages whose es-419, es-AR or
// pt-BR copy is more than 30% longer or shorter than English, so layouts hold
// in every language (Hugo, TASK-23054). Always exits 0.
//
// - Length = characters a reader sees: `{arg}` placeholders and rich-text tags
//   are dropped, a plural or select keeps its longest branch.
// - es-AR is compared after its es-419 fallback is applied. Rows es-AR only
//   inherits are counted but listed under es-419.
// - English strings under 8 characters are skipped: there, 30% is 1-2 letters.
// - "Titles" are keys ending in title/heading/label/cta, plus any English
//   string under 40 characters. They are listed first.
// - Intentional exceptions go in scripts/i18n-length-drift-allowlist.json as
//   `{ "key": "a.b.c", "locale": "pt-BR", "reason": "why" }` (omit `locale`
//   for every locale).
//
// usage:
//   node scripts/i18n-length-drift.mjs            # report (also appended to $GITHUB_STEP_SUMMARY)
//   node scripts/i18n-length-drift.mjs --json     # every flagged key, machine-readable
//   flags: --top N (rows per list, default 15)

import { appendFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { measureDrift, ALLOWLIST_PATH } = require('./i18n-length-drift-core.cjs')

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const topIndex = args.indexOf('--top')
const top = topIndex === -1 ? 15 : Number(args[topIndex + 1])

const result = measureDrift(ROOT)

if (args.includes('--json')) {
    console.log(JSON.stringify(result, null, 2))
    process.exit(0)
}

const pct = (d) => `${d > 0 ? '+' : ''}${Math.round(d * 100)}%`
const cell = (raw, max = 70) => {
    const s = raw.replace(/\s+/g, ' ')
    const clipped = s.length > max ? `${s.slice(0, max - 1)}…` : s
    return clipped.replace(/\|/g, '\\|')
}
const table = (rows) => [
    '| drift | key | en | translation |',
    '|--:|---|---|---|',
    ...rows.map((f) => `| ${pct(f.drift)} | \`${f.key}\` | ${cell(f.en)} | ${cell(f.text)} |`),
]

const lines = [
    '## i18n length drift',
    '',
    `Advisory, never fails. Flags keys whose visible length differs from English by more than ${Math.round(
        result.threshold * 100
    )}%. Intentional exceptions: \`${ALLOWLIST_PATH}\`. Rules: header of \`scripts/i18n-length-drift.mjs\`.`,
    '',
    '| locale | compared | flagged (inherited) | titles | longer | shorter | allowlisted |',
    '|---|--:|--:|--:|--:|--:|--:|',
]
for (const { locale, compared, allowlisted, flagged } of result.locales) {
    const inherited = flagged.filter((f) => f.inherited).length
    const note = inherited ? ` (${inherited})` : ''
    lines.push(
        `| ${locale} | ${compared} | ${flagged.length}${note} | ${flagged.filter((f) => f.title).length} | ` +
            `${flagged.filter((f) => f.drift > 0).length} | ${flagged.filter((f) => f.drift < 0).length} | ${allowlisted} |`
    )
}
lines.push('')

for (const { locale, flagged } of result.locales) {
    const own = flagged.filter((f) => !f.inherited)
    const titles = own.filter((f) => f.title)
    const other = own.filter((f) => !f.title)
    if (titles.length)
        lines.push(
            `### ${locale}: titles (top ${Math.min(top, titles.length)} of ${titles.length})`,
            '',
            ...table(titles.slice(0, top)),
            ''
        )
    if (other.length)
        lines.push(
            `### ${locale}: other copy (top ${Math.min(top, other.length)} of ${other.length})`,
            '',
            ...table(other.slice(0, top)),
            ''
        )
}

if (result.missingReason.length) {
    lines.push(`Allowlist entries with no reason: ${result.missingReason.map((e) => `\`${e.key}\``).join(', ')}.`, '')
}
if (result.staleAllowlist.length) {
    lines.push(
        `Allowlist entries that no longer drift: ${result.staleAllowlist.map((e) => `\`${e.key}\``).join(', ')}.`,
        ''
    )
}

const report = lines.join('\n')
console.log(report)
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, report + '\n')
