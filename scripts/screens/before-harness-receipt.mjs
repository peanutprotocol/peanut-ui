import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// The only migration applied to a legacy base runner is its process exit policy.
// Exact bytes avoid accidentally changing a newer or otherwise unsupported runner.
const statusPath = 'scripts/screens/capture-status.mjs'
const legacyPolicy = `export function captureExitCode(results) {
    return results.some((result) => result.status === 'failed') ? 1 : 0
}
`
const partialPolicy = legacyPolicy.replace("=== 'failed') ? 1 : 0", "=== 'captured') ? 0 : 1")
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')

// read instead of exists-then-read, so nothing can change between the check and the write
function readIfPresent(path) {
    try {
        return readFileSync(path, 'utf8')
    } catch (error) {
        if (error.code === 'ENOENT') return undefined
        throw error
    }
}

export function prepareBaseExitPolicy(directory) {
    const path = join(directory, statusPath)
    if (readIfPresent(path) !== legacyPolicy) return
    const recordPath = join(directory, '.screen-capture-adapter.json')
    const recorded = readIfPresent(recordPath)
    const record = recorded === undefined ? { version: 1, changed: [] } : JSON.parse(recorded)
    record.changed.push({ path: statusPath, before: sha256(legacyPolicy), after: sha256(partialPolicy) })
    writeFileSync(recordPath, JSON.stringify(record))
    writeFileSync(path, partialPolicy)
}

export function verifyBaseExitPolicy(capture) {
    const overlays = (capture.adapterFiles ?? []).filter(({ path }) => path === statusPath)
    if (
        overlays.length &&
        (overlays.length !== 1 ||
            overlays[0].before !== sha256(legacyPolicy) ||
            overlays[0].after !== sha256(partialPolicy))
    )
        throw new Error('Unrecognized base harness exit policy overlay')
}
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
