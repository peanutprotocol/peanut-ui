import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { validateBeforeHarness } from './before-harness-receipt.mjs'

const directory = process.argv[2]
const capture = JSON.parse(readFileSync(join(directory, 'capture.json'), 'utf8'))
const receipt = validateBeforeHarness({ schema: 1, mode: 'base', harnessCommit: process.env.BEFORE }, capture.commit)
writeFileSync(join(directory, 'before-harness.json'), JSON.stringify(receipt))
