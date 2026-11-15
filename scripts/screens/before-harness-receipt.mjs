import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export const BASE_HARNESS_NOTE =
    "Before was captured with the base branch's own synthetic API because this PR changes it; differences can include synthetic-data changes."

export function validateBeforeHarness(receipt, commit) {
    if (receipt === undefined) return undefined
    if (
        receipt?.schema !== 1 ||
        receipt.mode !== 'base' ||
        !/^[a-f0-9]{40}$/.test(commit ?? '') ||
        receipt.harnessCommit !== commit
    )
        throw new Error('Invalid before harness receipt')
    return { schema: 1, mode: 'base', harnessCommit: commit }
}

export function readBeforeHarness(directory, commit) {
    const path = join(directory, 'before-harness.json')
    return existsSync(path) ? validateBeforeHarness(JSON.parse(readFileSync(path, 'utf8')), commit) : undefined
}
