import { appendFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { selectBeforeHarness, beforeBaseCapability } from './before-harness.mjs'

const target = process.argv.find((arg) => arg.startsWith('--target='))?.slice('--target='.length)
let mode, key
if (target) {
    mode = process.env.BEFORE_HARNESS ?? 'head'
    if (!['head', 'base'].includes(mode)) throw new Error('Invalid before harness mode')
    if (
        mode === 'base' &&
        !beforeBaseCapability({
            read: (path) => readFileSync(join(target, path), 'utf8'),
            only: process.env.CAPTURE_ONLY,
            fullCatalogue: process.env.FULL_CATALOGUE === 'true',
        })
    ) {
        console.log('Base harness runner or required flags unavailable; falling back to head harness.')
        mode = 'head'
    }
    key = 'mode'
} else {
    mode = selectBeforeHarness({ before: process.env.BEFORE, after: process.env.AFTER })
    key = 'before_harness'
}
console.log(`Before capture harness: ${mode}`)
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${mode}\n`)
