#!/usr/bin/env node
// PR "lines added" breakdown by category and kind.
//
// Classifies every ADDED line in `git diff <base> <head>` into a CATEGORY
// (by file path) and a KIND (by content), then prints a markdown table.
// The point: a raw "+39,874 lines" number is mostly generated snapshots,
// lockfiles and tests — this separates hand-written code from the rest.
//
// Deterministic, zero dependencies. Runs in CI and posts a sticky PR comment.
//
// Usage: node scripts/pr-loc-breakdown.mjs <base-ref> <head-ref>

import { spawnSync } from 'node:child_process'

const [base, head] = process.argv.slice(2)
if (!base || !head) {
    console.error('usage: node scripts/pr-loc-breakdown.mjs <base-ref> <head-ref>')
    process.exit(2)
}

// Path -> category. Order matters: the first match wins, so the specific
// categories (test, generated, fixture) are checked before the broad
// `production` extension fallback. Kept in lockstep with the one-off
// classifier Hugo ran on api#1624 so the numbers stay comparable.
function category(file) {
    const f = file.toLowerCase()
    if (f.includes('package-lock') || f.includes('pnpm-lock')) return 'generated'
    if (
        f.includes('.generated.') ||
        f.includes('api.openapi.json') ||
        f.endsWith('openapi.json') ||
        f.includes('legal-versions.generated')
    )
        return 'generated'
    if (f.includes('/i18n/') || f.includes('/messages/')) return 'i18n'
    if (f.includes('fixture')) return 'fixture'
    if (f.includes('__tests__') || f.includes('.test.') || f.includes('.spec.') || f.includes('/e2e/')) return 'test'
    if (f.endsWith('.md') || f.endsWith('.mdx')) return 'docs'
    if (f.includes('/public/') || f.endsWith('.svg')) return 'asset'
    if (/\.(ts|tsx|js|jsx|mjs|css|scss)$/.test(f)) return 'production'
    return 'other'
}

// Data categories carry no comment concept — every non-blank line is data.
const DATA_CATS = new Set(['generated', 'i18n', 'asset'])

function kind(cat, content) {
    const s = content.trim()
    if (s === '') return 'blank'
    if (DATA_CATS.has(cat)) return 'code'
    if (s.startsWith('//') || s.startsWith('/*') || s.startsWith('*/') || s.startsWith('*')) return 'comment'
    return 'code'
}

const git = spawnSync('git', ['diff', '--no-color', '--no-renames', base, head], {
    encoding: 'utf8',
    maxBuffer: 512 * 1024 * 1024,
})
if (git.status !== 0) {
    console.error(git.stderr || `git diff ${base} ${head} failed`)
    process.exit(1)
}

// (category, kind) -> added count; category -> {added, removed}; large
// generated files -> per-file added/removed for the churn note.
const cell = new Map()
const catTotals = new Map()
const perFile = new Map()
let curFile = null

const bump = (map, key, n = 1) => map.set(key, (map.get(key) || 0) + n)

for (const line of git.stdout.split('\n')) {
    if (line.startsWith('+++ b/')) {
        curFile = line.slice(6)
        continue
    }
    if (line.startsWith('+++') || line.startsWith('---')) continue
    if (line.startsWith('diff --git') || line.startsWith('@@') || line.startsWith('index ')) continue

    const added = line.startsWith('+')
    const removed = line.startsWith('-')
    if (!added && !removed) continue

    const cat = curFile ? category(curFile) : 'other'
    const totals = catTotals.get(cat) || { added: 0, removed: 0 }
    const fileRec = perFile.get(curFile) || { cat, added: 0, removed: 0 }

    if (added) {
        totals.added++
        fileRec.added++
        bump(cell, `${cat}\t${kind(cat, line.slice(1))}`)
    } else {
        totals.removed++
        fileRec.removed++
    }
    catTotals.set(cat, totals)
    if (curFile) perFile.set(curFile, fileRec)
}

// --- render ---------------------------------------------------------------
const cats = [...catTotals.keys()].sort((a, b) => (catTotals.get(b).added || 0) - (catTotals.get(a).added || 0))
const get = (c, k) => cell.get(`${c}\t${k}`) || 0

let totCode = 0,
    totComment = 0,
    totBlank = 0,
    totAdded = 0,
    totRemoved = 0
const rows = []
for (const c of cats) {
    const code = get(c, 'code')
    const comment = get(c, 'comment')
    const blank = get(c, 'blank')
    const added = catTotals.get(c).added
    const removed = catTotals.get(c).removed
    totCode += code
    totComment += comment
    totBlank += blank
    totAdded += added
    totRemoved += removed
    rows.push({ c, code, comment, blank, added, removed })
}

// "Hand-written" = code-kind lines in production + test + fixture + other.
// Generated / i18n / asset / docs / lockfile are not hand-authored logic.
const HANDWRITTEN = new Set(['production', 'test', 'fixture', 'other'])
let handCode = 0
for (const c of cats) if (HANDWRITTEN.has(c)) handCode += get(c, 'code')

const out = []
out.push('## Lines-added breakdown')
out.push('')
out.push(
    `**+${totAdded.toLocaleString()} added** / -${totRemoved.toLocaleString()} removed. ` +
        `~**${handCode.toLocaleString()}** are hand-written code lines (production + test + other, code only); ` +
        `the rest is generated output, data, comments and blanks.`
)
out.push('')
out.push('| Category | Code | Comment | Blank | Added | Removed |')
out.push('|---|--:|--:|--:|--:|--:|')
for (const r of rows) {
    out.push(
        `| ${r.c} | ${r.code.toLocaleString()} | ${r.comment.toLocaleString()} | ${r.blank.toLocaleString()} | ${r.added.toLocaleString()} | ${r.removed.toLocaleString()} |`
    )
}
out.push(
    `| **total** | **${totCode.toLocaleString()}** | **${totComment.toLocaleString()}** | **${totBlank.toLocaleString()}** | **${totAdded.toLocaleString()}** | **${totRemoved.toLocaleString()}** |`
)
out.push('')

// Reserialization churn: a large generated file whose removed count is close
// to its added count is a re-emitted snapshot, not real new content. Flag it
// so a reviewer does not read the added number as new work.
const churn = []
for (const [file, rec] of perFile) {
    if (rec.cat !== 'generated') continue
    if (rec.added < 400) continue
    const net = rec.added - rec.removed
    if (rec.removed >= rec.added * 0.5) {
        churn.push({ file, added: rec.added, removed: rec.removed, net })
    }
}
if (churn.length) {
    churn.sort((a, b) => b.added - a.added)
    out.push('### Reserialization churn (generated files)')
    out.push('')
    out.push(
        'These generated files re-emit most of their content on every change. Added ≈ removed, so the added count is churn, not new work — net-new is small.'
    )
    out.push('')
    out.push('| File | Added | Removed | Net-new |')
    out.push('|---|--:|--:|--:|')
    for (const g of churn) {
        out.push(
            `| \`${g.file}\` | ${g.added.toLocaleString()} | ${g.removed.toLocaleString()} | ${g.net.toLocaleString()} |`
        )
    }
    out.push('')
}

out.push('<sub>By file path + line content, added lines only. Advisory — never blocks a merge.</sub>')

process.stdout.write(out.join('\n') + '\n')
