import { bundle } from './bundle.mjs'
import { readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { compare, validateCapture, verifyAsset } from './core.mjs'
const [beforeDir, afterDir, destination] = process.argv.slice(2)
if (!beforeDir || !afterDir || !destination) throw new Error('Usage: report.mjs BEFORE AFTER OUTPUT')
const out = resolve(destination),
    assets = join(out, 'assets')
mkdirSync(assets, { recursive: true })
const captures = [beforeDir, afterDir].map((dir) =>
    validateCapture(JSON.parse(readFileSync(join(dir, 'capture.json'), 'utf8')))
)
for (const [i, dir] of [beforeDir, afterDir].entries())
    for (const screen of captures[i].screens)
        if (screen.status === 'captured')
            for (const name of [screen.image, screen.thumbnail]) {
                verifyAsset(join(dir, 'assets'), name)
                copyFileSync(join(dir, 'assets', name), join(assets, name))
            }
const report = compare(captures[0], captures[1], assets)
writeFileSync(join(out, 'manifest.json'), JSON.stringify(report, null, 2))
console.log(`${report.screens.length} states; complete=${report.complete}`)

bundle(out)
