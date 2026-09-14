#!/usr/bin/env node
// Turns the JSON from scripts/visual-diff.mjs into the PR comment body.
//
// usage:
//   node scripts/visual-comment.mjs <diff.json> --assets=<url-prefix> [options]
//   node scripts/visual-comment.mjs <diff.json> --list
//
// options:
//   --assets=<url>    where the PNGs are published. The script appends
//                     base/<file>, head/<file> and diff/<file>.
//   --baseline=<sha>  commit the baseline shots came from
//   --head=<sha>      commit under test
//   --screens=<n>     how many screens get images (default 6)
//   --rows=<n>        how many screens get a table row (default 20)
//   --list            print the shot files that need publishing, one a line,
//                     and nothing else. The workflow copies exactly these.
//
// A screen is captured at four widths, so the raw diff lists the same screen
// four times. The comment groups by screen and reports its worst width: twelve
// rows a reader scans beats forty-eight rows a reader skips.
//
// Kept out of visual-diff.mjs on purpose — that tool is for a human at a
// terminal and must stay readable there.

import { readFileSync } from 'node:fs'

const args = process.argv.slice(2)
const flag = (name, fallback) => {
    const hit = args.find((a) => a.startsWith(`--${name}=`))
    return hit === undefined ? fallback : hit.slice(name.length + 3)
}

const [jsonPath] = args.filter((a) => !a.startsWith('-'))
if (!jsonPath) {
    console.error('need the diff json. see the header.')
    process.exit(2)
}

const report = JSON.parse(readFileSync(jsonPath, 'utf8'))
const screenLimit = Number(flag('screens', '6'))
const rowLimit = Number(flag('rows', '20'))

// `<fixture>@<width>.png` -> `<fixture>` and `<width>`.
const screenOf = (file) => file.replace(/@\d+\.png$/, '')
const widthOf = (file) => Number(file.match(/@(\d+)\.png$/)?.[1] ?? 0)

// Group the shots of one screen together, keeping the width that moved most.
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

const screens = byScreen(report.changed)
const shown = screens.slice(0, screenLimit)

// --list is the publish step's input, so it runs before any markdown.
if (args.includes('--list')) {
    for (const g of shown) console.log(g.worst.file)
    process.exit(0)
}

const assets = flag('assets', '')
const short = (sha) => (sha ? `\`${sha.slice(0, 7)}\`` : '`unknown`')
const provenance = `baseline ${short(flag('baseline', ''))} → head ${short(flag('head', ''))}`
const totalShots = report.changed.length + report.unchanged

// Counts of files, folded to a count of screens where that reads better.
const screenCount = (files) => new Set(files.map(screenOf)).size

// One marker line so the next run finds this comment and edits it.
const out = ['<!-- ds-shots -->']
const quiet = report.changed.length === 0 && report.added.length === 0 && report.removed.length === 0

if (quiet) {
    out.push('## 🖼 Visual diff — no screen moved', '', `${totalShots} shots, all identical. ${provenance}.`)
} else {
    const moved =
        screens.length === 0 ? 'no screen moved' : `${screens.length} screen${screens.length === 1 ? '' : 's'} moved`
    out.push(`## 🖼 Visual diff — ${moved}`, '')
    out.push(
        `${report.changed.length} of ${totalShots} shots changed · ${report.unchanged} identical · ${provenance}`,
        ''
    )

    if (screens.length > 0) {
        out.push('| worst % | screen | widths |', '| ---: | --- | --- |')
        for (const g of screens.slice(0, rowLimit)) {
            const note = g.worst.note ? ` — resized ${g.worst.note}` : ''
            out.push(`| ${g.worst.percent.toFixed(2)}% | \`${g.name}\`${note} | ${g.widths.join(', ')} |`)
        }
        if (screens.length > rowLimit) out.push(`| | …and ${screens.length - rowLimit} more | |`)
        out.push('')
    }

    // Names for added and removed, folded to one line a screen: a fixture that
    // appeared or vanished is a review question, and there are never many.
    for (const [title, list] of [
        ['new screens', report.added],
        ['gone screens', report.removed],
    ]) {
        if (list.length === 0) continue
        const names = [...new Set(list.map(screenOf))].sort()
        out.push(`<details><summary>${title} (${screenCount(list)})</summary>`, '')
        for (const n of names) out.push(`- \`${n}\``)
        out.push('', '</details>', '')
    }
}

if (shown.length > 0 && assets) {
    const img = (kind, file) => `<img width="200" alt="${kind}" src="${assets}/${kind}/${file}">`
    out.push('---', '')
    const lead =
        screens.length > shown.length
            ? `The ${shown.length} screens that moved most, at their worst width.`
            : 'Every screen that moved, at its worst width.'
    out.push(lead, '')
    for (const g of shown) {
        const { file, percent, note } = g.worst
        out.push(`#### \`${g.name}\` @ ${widthOf(file)} — ${percent.toFixed(2)}%`, '')
        // A resized screen has no diff image: visual-diff.mjs cannot overlay two
        // different shapes, so it reports the sizes instead.
        out.push('| before | after | what moved |', '| --- | --- | --- |')
        out.push(`| ${img('base', file)} | ${img('head', file)} | ${note ? `resized ${note}` : img('diff', file)} |`)
        out.push('')
    }
}

out.push('', '<sub>Fixture screenshots, no backend. Advisory — this check never blocks a merge.</sub>')

console.log(out.join('\n'))
