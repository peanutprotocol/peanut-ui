#!/usr/bin/env node
// Compares two capture directories made by playwright.shots.config.ts.
// Pairs files by name (`<fixture>@<width>.png`) and reports what moved.
//
// usage:
//   node scripts/visual-diff.mjs <beforeDir> <afterDir> [options]
//
// options:
//   --out=<dir>         where to write diff images (default e2e/__shots__/diff)
//   --threshold=<0..1>  pixelmatch colour tolerance per pixel (default 0.1)
//   --json              machine-readable output instead of the table
//   --help              this text
//
// Changed screens are information, not failure: the exit code is 0 whenever the
// comparison runs. A non-zero exit means the tool itself broke.

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { PNG } from 'pngjs'
import pixelmatch from 'pixelmatch'

const HELP = `compare two screenshot directories from npm run test:visual.

usage:
  node scripts/visual-diff.mjs <beforeDir> <afterDir> [options]

options:
  --out=<dir>         where to write diff images (default e2e/__shots__/diff)
  --threshold=<0..1>  pixelmatch colour tolerance per pixel (default 0.1)
  --json              machine-readable output instead of the table
  --help              this text

exit code is 0 even when screens changed. non-zero means the tool broke.`

const args = process.argv.slice(2)
if (args.includes('--help') || args.includes('-h')) {
    console.log(HELP)
    process.exit(0)
}

const flag = (name, fallback) => {
    const hit = args.find((a) => a.startsWith(`--${name}=`))
    return hit === undefined ? fallback : hit.slice(name.length + 3)
}

const [beforeDir, afterDir] = args.filter((a) => !a.startsWith('-'))
const outDir = flag('out', 'e2e/__shots__/diff')
const threshold = Number(flag('threshold', '0.1'))
const asJson = args.includes('--json')

if (!beforeDir || !afterDir) {
    console.error('need two directories. run with --help.')
    process.exit(2)
}
for (const dir of [beforeDir, afterDir]) {
    if (!existsSync(dir)) {
        console.error(`no such directory: ${dir}`)
        process.exit(2)
    }
}

const shots = (dir) => new Set(readdirSync(dir).filter((f) => f.endsWith('.png')))
const before = shots(beforeDir)
const after = shots(afterDir)

mkdirSync(outDir, { recursive: true })

const changed = []
let unchanged = 0

for (const file of [...after].filter((f) => before.has(f)).sort()) {
    const a = PNG.sync.read(readFileSync(join(beforeDir, file)))
    const b = PNG.sync.read(readFileSync(join(afterDir, file)))

    // A resized screen is a change, not a crash. pixelmatch throws on mismatched
    // dimensions, so report it before calling it.
    if (a.width !== b.width || a.height !== b.height) {
        changed.push({
            file,
            percent: 100,
            pixels: b.width * b.height,
            note: `${a.width}x${a.height} -> ${b.width}x${b.height}`,
        })
        continue
    }

    const diff = new PNG({ width: a.width, height: a.height })
    const pixels = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold })
    if (pixels === 0) {
        unchanged++
        continue
    }
    writeFileSync(join(outDir, file), PNG.sync.write(diff))
    changed.push({ file, percent: (pixels / (a.width * a.height)) * 100, pixels })
}

const added = [...after].filter((f) => !before.has(f)).sort()
const removed = [...before].filter((f) => !after.has(f)).sort()

changed.sort((x, y) => y.percent - x.percent)

if (asJson) {
    console.log(JSON.stringify({ beforeDir, afterDir, outDir, changed, unchanged, added, removed }, null, 2))
    process.exit(0)
}

console.log(`${beforeDir} -> ${afterDir}`)
console.log(`${changed.length} changed, ${unchanged} unchanged, ${added.length} added, ${removed.length} removed\n`)

// Percentage first: it is the only column a reader sorts on.
for (const c of changed) {
    const pct = c.percent.toFixed(2).padStart(7)
    console.log(`${pct}%  ${c.file}${c.note ? `  (${c.note})` : ''}`)
}
if (changed.length > 0) console.log(`\ndiff images: ${outDir}`)
for (const f of added) console.log(`  added    ${f}`)
for (const f of removed) console.log(`  removed  ${f}`)
