import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { validateBeforeHarness, prepareBaseExitPolicy, verifyBaseExitPolicy } from './before-harness-receipt.mjs'

if (process.argv[2] === '--prepare-exit-policy') {
    prepareBaseExitPolicy(process.argv[3])
    process.exit(0)
}
const directory = process.argv[2]
const capture = JSON.parse(readFileSync(join(directory, 'capture.json'), 'utf8'))
verifyBaseExitPolicy(capture)
const receipt = validateBeforeHarness({ schema: 1, mode: 'base', harnessCommit: process.env.BEFORE }, capture.commit)
writeFileSync(join(directory, 'before-harness.json'), JSON.stringify(receipt))
