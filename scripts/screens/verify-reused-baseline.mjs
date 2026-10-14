import { readFileSync, mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { hash } from './core.mjs'
import { canReuseBaseline } from './baseline-reuse.mjs'
import { verifyBaselineSource } from './baseline-source.mjs'

/** Reauthenticate both provider provenance and actual source bytes in the trusted publisher. */
export function verifyReusedBaseline({ receipt, beforeBytes, after, expectedCommit, repository, api, download }) {
    if (
        receipt?.schema !== 1 ||
        !/^[1-9]\d*$/.test(receipt.runId ?? '') ||
        !/^[a-z0-9-]{1,200}$/.test(receipt.artifact ?? '') ||
        !/^[a-f0-9]{64}$/.test(receipt.manifestDigest ?? '') ||
        receipt.commit !== expectedCommit ||
        receipt.locale !== after.locale ||
        hash(beforeBytes) !== receipt.manifestDigest
    )
        throw new Error('Invalid reused baseline receipt or manifest bytes')
    const run = api(`actions/runs/${receipt.runId}`)
    const verified = verifyBaselineSource({ api, repository, expectedCommit, run })
    if (!verified || !verified.artifacts.some((artifact) => artifact.name === receipt.artifact))
        throw new Error('Reused baseline source run or artifact is not trusted')
    const directory = mkdtempSync(join(tmpdir(), 'screen-baseline-source-'))
    try {
        console.log(
            `Baseline publication verification phase=source-download locale=${after.locale} run=${receipt.runId} budget=180s`
        )
        download(receipt.runId, receipt.artifact, directory)
        const sourceBytes = readFileSync(join(directory, 'capture.json'))
        if (
            hash(sourceBytes) !== receipt.manifestDigest ||
            !canReuseBaseline(JSON.parse(sourceBytes), after, expectedCommit)
        )
            throw new Error('Reused baseline differs from its verified external source or environment')
    } finally {
        rmSync(directory, { recursive: true, force: true })
    }
}
