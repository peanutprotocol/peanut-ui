import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
    completeBaselineArtifacts,
    trustedIntegrationBaselineRun,
    trustedScheduledBaselineRun,
    verifiedExternalBaselineSource,
} from './baseline-runs.mjs'

const repository = 'peanutprotocol/peanut-ui'
const sha = 'a'.repeat(40)
const locales = ['en', 'es-419', 'es-AR', 'pt-BR']
const integrationRun = {
    path: '.github/workflows/screen-library.yml',
    event: 'push',
    head_branch: 'dev',
    head_sha: sha,
    head_repository: { full_name: repository },
    status: 'completed',
    conclusion: 'failure',
}
const captureJobs = locales.map((locale) => ({
    name: `capture_after (${locale})`,
    status: 'completed',
    conclusion: 'success',
}))

test('accepts complete trusted integration captures when only a later job failed', () => {
    assert.equal(trustedIntegrationBaselineRun(integrationRun, captureJobs, repository, sha), true)
    assert.equal(
        trustedIntegrationBaselineRun(
            integrationRun,
            captureJobs.map((job, index) => (index ? job : { ...job, conclusion: 'failure' })),
            repository,
            sha
        ),
        false
    )
})

test('keeps a failed integration run valid from resolver selection through publisher verification', () => {
    const artifacts = locales.map((locale) => ({
        name: `screen-library-after-${locale}-1`,
        expired: false,
    }))
    const verified = verifiedExternalBaselineSource({
        run: integrationRun,
        jobs: captureJobs,
        artifacts,
        repository,
        expectedCommit: sha,
        defaultBranch: 'main',
    })
    assert.equal(verified?.kind, 'integration')
    assert.deepEqual(
        verified?.artifacts.map((artifact) => artifact.name),
        artifacts.map((artifact) => artifact.name)
    )
})

test('resolver and publisher use the same external baseline verifier', () => {
    for (const file of ['resolve-baseline.mjs', 'publish-run.mjs'])
        assert.match(readFileSync(new URL(file, import.meta.url), 'utf8'), /verifiedExternalBaselineSource\s*\(/)
})

test('requires a complete retained locale artifact matrix', () => {
    const artifacts = locales.map((locale) => ({ name: `screen-library-after-${locale}-1`, expired: false }))
    assert.equal(completeBaselineArtifacts(artifacts, 'integration', sha).length, 4)
    assert.deepEqual(completeBaselineArtifacts(artifacts.slice(1), 'integration', sha), [])
})

test('scheduled baselines must be successful runs on the default branch', () => {
    const run = {
        path: '.github/workflows/screen-library-baseline.yml',
        event: 'push',
        head_branch: 'main',
        head_repository: { full_name: repository },
        status: 'completed',
        conclusion: 'success',
    }
    assert.equal(trustedScheduledBaselineRun(run, repository, 'main'), true)
    assert.equal(trustedScheduledBaselineRun({ ...run, conclusion: 'failure' }, repository, 'main'), false)
})
