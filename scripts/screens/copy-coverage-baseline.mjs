/** Rewrites the copy baseline from a full English capture: drops shown or deleted keys, keeps reasons. */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { validateCapture } from './core.mjs'
import { copyCoverage, flattenMessages, parseCopyBaseline } from './copy-coverage.mjs'

export const BASELINE_PATH = 'scripts/screens/copy-coverage-baseline.json'
export const DEFAULT_REASON = 'No capture state shows this copy yet'

export function nextBaseline({ capture, catalogue, previous, addNew }) {
    const validated = validateCapture(capture)
    if (validated.locale !== 'en' || validated.scope || validated.complete !== true)
        throw new Error('The copy baseline needs a complete, unscoped English capture')
    const coverage = copyCoverage(validated, catalogue)
    const keys = {}
    for (const { key } of coverage.neverShown)
        if (previous.has(key)) keys[key] = previous.get(key)
        else if (addNew) keys[key] = DEFAULT_REASON
    return { schema: 1, keys }
}

const isMain = process.argv[1]?.endsWith('/copy-coverage-baseline.mjs')
if (isMain) {
    const captureDir = process.argv[2]
    if (!captureDir || !existsSync(join(captureDir, 'capture.json')))
        throw new Error('Usage: node scripts/screens/copy-coverage-baseline.mjs <capture-dir> [--add-new]')
    const previous = existsSync(BASELINE_PATH)
        ? parseCopyBaseline(JSON.parse(readFileSync(BASELINE_PATH, 'utf8')))
        : new Map()
    const baseline = nextBaseline({
        capture: JSON.parse(readFileSync(join(captureDir, 'capture.json'), 'utf8')),
        catalogue: flattenMessages(JSON.parse(readFileSync('src/i18n/app/messages/en.json', 'utf8'))),
        previous,
        addNew: process.argv.includes('--add-new') || !existsSync(BASELINE_PATH),
    })
    writeFileSync(BASELINE_PATH, `${JSON.stringify(baseline, null, 4)}\n`)
    const removed = [...previous.keys()].filter((key) => !(key in baseline.keys))
    console.log(`${Object.keys(baseline.keys).length} baseline keys; removed ${removed.length}`)
}
