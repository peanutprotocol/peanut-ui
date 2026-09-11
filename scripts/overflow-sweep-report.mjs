// folds the per-test JSON lines the sweep writes into one report:
//   node scripts/overflow-sweep-report.mjs [e2e/__sweep__] > summary
// writes e2e/__sweep__/sweep-report.json and prints a human summary.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const dir = process.argv[2] ?? 'e2e/__sweep__'
const cells = []
for (const f of readdirSync(dir).filter((f) => f.endsWith('.jsonl'))) {
    for (const line of readFileSync(join(dir, f), 'utf8').split('\n')) {
        if (line.trim()) cells.push(JSON.parse(line))
    }
}

cells.sort((a, b) => (a.id + a.width + a.locale).localeCompare(b.id + b.width + b.locale))
const fails = cells.filter((c) => c.status === 'fail')
const skips = cells.filter((c) => c.status === 'skip')
const passes = cells.filter((c) => c.status === 'pass')

const byKind = {}
for (const c of cells) byKind[c.kind] = (byKind[c.kind] ?? 0) + 1

const report = {
    generated: new Date().toISOString(),
    totals: { cells: cells.length, pass: passes.length, fail: fails.length, skip: skips.length, byKind },
    fails,
    skips,
    cells,
}
writeFileSync(join(dir, 'sweep-report.json'), JSON.stringify(report, null, 2))

console.log(`sweep: ${cells.length} cells — ${passes.length} pass, ${fails.length} fail, ${skips.length} skip`)
console.log('by kind:', JSON.stringify(byKind))
for (const f of fails) {
    console.log(`FAIL ${f.id} @${f.width} ${f.locale}`)
    for (const o of f.overflows ?? []) console.log(`   [${o.kind}] ${o.selector} — "${o.text}" (${o.detail})`)
}
for (const s of skips) console.log(`SKIP ${s.id} @${s.width} ${s.locale} — ${s.reason}`)
if (fails.length > 0) process.exitCode = 1
