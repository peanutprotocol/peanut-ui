import { selectBaselineArtifacts } from './baseline-artifacts.mjs'

const locales = ['en', 'es-419', 'es-AR', 'pt-BR']

export function completeBaselineArtifacts(artifacts, kind, expectedCommit) {
    const retained = artifacts.filter((artifact) => !artifact.expired)
    const selected = selectBaselineArtifacts(
        retained.map((artifact) => artifact.name),
        kind,
        expectedCommit
    )
    if (selected.length !== locales.length) return []
    return selected.map((selection) => retained.find((artifact) => artifact.name === selection.name))
}

export function trustedIntegrationBaselineRun(run, jobs, repository, expectedCommit) {
    if (
        run.path !== '.github/workflows/screen-library.yml' ||
        run.event !== 'push' ||
        run.head_branch !== 'dev' ||
        run.head_sha !== expectedCommit ||
        run.head_repository?.full_name !== repository ||
        run.status !== 'completed'
    )
        return false
    const successfulJobs = new Set(
        jobs.filter((job) => job.status === 'completed' && job.conclusion === 'success').map((job) => job.name)
    )
    return locales.every((locale) => successfulJobs.has(`capture_after (${locale})`))
}

export function trustedScheduledBaselineRun(run, repository, defaultBranch) {
    return (
        run.path === '.github/workflows/screen-library-baseline.yml' &&
        ['push', 'workflow_dispatch'].includes(run.event) &&
        run.head_repository?.full_name === repository &&
        run.head_branch === defaultBranch &&
        run.status === 'completed' &&
        run.conclusion === 'success'
    )
}

export function verifiedExternalBaselineSource({
    run,
    jobs = [],
    artifacts,
    repository,
    expectedCommit,
    defaultBranch,
}) {
    if (trustedIntegrationBaselineRun(run, jobs, repository, expectedCommit)) {
        const complete = completeBaselineArtifacts(artifacts, 'integration', expectedCommit)
        if (complete.length) return { kind: 'integration', artifacts: complete }
    }
    if (trustedScheduledBaselineRun(run, repository, defaultBranch)) {
        const complete = completeBaselineArtifacts(artifacts, 'baseline', expectedCommit)
        if (complete.length) return { kind: 'baseline', artifacts: complete }
    }
    return null
}
