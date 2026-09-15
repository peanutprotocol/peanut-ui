import test from 'node:test'
import assert from 'node:assert/strict'
import {
    completeBaselineArtifacts,
    trustedIntegrationBaselineRun,
    trustedScheduledBaselineRun,
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
