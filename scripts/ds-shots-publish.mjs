#!/usr/bin/env node
// Renders the ds-shots PR comment from the report.json a Tests run uploaded
// as the visual-diff-report-<pr> artifact. Runs only in ds-shots-comment.yml,
// the workflow_run publisher — never inside the job that runs PR code.
//
// TRUST BOUNDARY: the report was written by a job that executed the PR's
// install, build and test code, so every byte of it is attacker-controlled.
// This script validates the report against a strict schema and refuses the
// whole file on any violation. The file-name character class has no slash,
// backslash, pipe, backtick or angle bracket, so no validated string can
// traverse a path or break out of its markdown cell — nothing here needs
// escaping. Nothing from the report is ever executed or linked.
//
// Deliberately separate from scripts/visual-comment.mjs: that script renders
// the in-run job summary, trusts its own input, and a PR may edit it. This
// one always runs from the default branch and trusts nothing.
//
// usage:
//   node scripts/ds-shots-publish.mjs <report.json> > body.md
//
// env (set by the publisher workflow, trusted):
//   RUN_URL       html url of the triggering Tests run, for the summary link
//   ARTIFACT_URL  download url of the PNG artifact; empty when nothing moved
//   HEAD_SHA      the commit the run tested, from the workflow_run event
//
// exit 0: markdown on stdout. exit 1: the report is out of contract — the
// publisher goes red and posts nothing, which is the wanted outcome for a
// tampered report.

import { readFileSync, statSync } from 'node:fs'

const MARKER = '<!-- ds-shots-visual-diff -->'
const MAX_BYTES = 1024 * 1024 // a legit report is a few KB
const MAX_ENTRIES = 1000 // 30 fixtures x 4 widths = 120 legit shots
const ROW_LIMIT = 20 // table rows, one per screen
const NAME_LIMIT = 30 // added/removed names listed before "…and N more"
const BODY_LIMIT = 65000 // github rejects a comment past 65536 bytes

// `<fixture>@<width>.png`, fixture ids from src/dev/fixtures/registry.ts.
const SHOT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}@\d{3,4}\.png$/
// visual-diff.mjs writes `640x1136 -> 640x1200` for a resized screen.
const NOTE = /^\d{1,5}x\d{1,5} -> \d{1,5}x\d{1,5}$/
const SHA40 = /^[0-9a-f]{40}$/

const fail = (why) => {
    console.error(`report rejected: ${why}`)
    process.exit(1)
}

const [reportPath] = process.argv.slice(2)
if (!reportPath) fail('no report path given')
if (statSync(reportPath).size > MAX_BYTES) fail('report too large')

let report
try {
    report = JSON.parse(readFileSync(reportPath, 'utf8'))
} catch {
    fail('not valid json')
}
if (typeof report !== 'object' || report === null || Array.isArray(report)) fail('not an object')

const isShot = (f) => typeof f === 'string' && SHOT.test(f)
const isCount = (n) => Number.isInteger(n) && n >= 0 && n <= 100_000_000

const { changed, unchanged, added, removed, baseline } = report
if (!Array.isArray(changed) || changed.length > MAX_ENTRIES) fail('changed is not an array of sane size')
for (const c of changed) {
    if (typeof c !== 'object' || c === null) fail('changed entry is not an object')
    if (!isShot(c.file)) fail(`bad file name ${JSON.stringify(String(c.file).slice(0, 80))}`)
    if (typeof c.percent !== 'number' || !Number.isFinite(c.percent) || c.percent < 0 || c.percent > 100)
        fail(`bad percent on ${c.file}`)
    if (!isCount(c.pixels)) fail(`bad pixels on ${c.file}`)
    if (c.note !== undefined && !(typeof c.note === 'string' && NOTE.test(c.note))) fail(`bad note on ${c.file}`)
}
if (!isCount(unchanged)) fail('bad unchanged count')
for (const [key, list] of [
    ['added', added],
    ['removed', removed],
]) {
    if (!Array.isArray(list) || list.length > MAX_ENTRIES || !list.every(isShot)) fail(`bad ${key} list`)
}
if (typeof baseline !== 'string' || !SHA40.test(baseline)) fail('bad baseline sha')

// Everything below only sees validated strings and numbers.

const screenOf = (file) => file.replace(/@\d+\.png$/, '')
const widthOf = (file) => Number(file.match(/@(\d+)\.png$/)[1])

// A screen is shot at four widths; group them and keep the worst width.
function byScreen(files) {
    const groups = new Map()
    for (const c of files) {
        const name = screenOf(c.file)
        const g = groups.get(name) ?? { name, worst: c, widths: [] }
        if (c.percent > g.worst.percent) g.worst = c
        g.widths.push(widthOf(c.file))
        groups.set(name, g)
    }
    for (const g of groups.values()) g.widths.sort((a, b) => a - b)
    return [...groups.values()].sort((a, b) => b.worst.percent - a.worst.percent)
}

const screens = byScreen(changed)
const short = (sha) => (sha && /^[0-9a-f]{7,40}$/.test(sha) ? `\`${sha.slice(0, 7)}\`` : '`unknown`')
const provenance = `baseline ${short(baseline)} → head ${short(process.env.HEAD_SHA ?? '')}`
const totalShots = changed.length + unchanged
const screenCount = (files) => new Set(files.map(screenOf)).size

const out = [MARKER, '']
const quiet = changed.length === 0 && added.length === 0 && removed.length === 0

if (quiet) {
    out.push('## 🖼 Visual diff — no screen moved', '', `${totalShots} shots, all identical. ${provenance}.`)
} else {
    const moved =
        screens.length === 0 ? 'no screen moved' : `${screens.length} screen${screens.length === 1 ? '' : 's'} moved`
    out.push(`## 🖼 Visual diff — ${moved}`, '')
    out.push(`${changed.length} of ${totalShots} shots changed · ${unchanged} identical · ${provenance}`, '')

    if (screens.length > 0) {
        out.push('| worst % | screen | widths |', '| ---: | --- | --- |')
        for (const g of screens.slice(0, ROW_LIMIT)) {
            const note = g.worst.note ? ` — resized ${g.worst.note}` : ''
            out.push(`| ${g.worst.percent.toFixed(2)}% | \`${g.name}\`${note} | ${g.widths.join(', ')} |`)
        }
        if (screens.length > ROW_LIMIT) out.push(`| | …and ${screens.length - ROW_LIMIT} more | |`)
        out.push('')
    }

    for (const [title, list] of [
        ['new screens', added],
        ['gone screens', removed],
    ]) {
        if (list.length === 0) continue
        const names = [...new Set(list.map(screenOf))].sort()
        out.push(`<details><summary>${title} (${screenCount(list)})</summary>`, '')
        for (const n of names.slice(0, NAME_LIMIT)) out.push(`- \`${n}\``)
        if (names.length > NAME_LIMIT) out.push(`- …and ${names.length - NAME_LIMIT} more`)
        out.push('', '</details>', '')
    }
}

const links = []
if (process.env.RUN_URL) links.push(`[job summary](${process.env.RUN_URL})`)
if (process.env.ARTIFACT_URL) links.push(`[before/after/diff images — artifact](${process.env.ARTIFACT_URL})`)
if (links.length > 0) out.push('', links.join(' · '))

out.push(
    '',
    '<sub>Fixture screenshots, no backend. Advisory — this check never blocks a merge. ' +
        'Posted from the default branch by ds-shots-comment.yml; the report it renders is untrusted data.</sub>'
)

const body = out.join('\n')
if (Buffer.byteLength(body) > BODY_LIMIT) fail('rendered body too large')
console.log(body)
