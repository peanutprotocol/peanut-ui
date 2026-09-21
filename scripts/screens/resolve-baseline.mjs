import { execFileSync } from 'node:child_process'
import { repositoryApiPath } from './repository-api.mjs'
import { reviewHeadRevision, reviewProvenance } from './review-provenance.mjs'
import { verifiedExternalBaselineSource } from './baseline-runs.mjs'

const repo = process.env.REPOSITORY,
    runId = process.env.RUN_ID
if (!/^[\w.-]+\/[\w.-]+$/.test(repo ?? '') || !/^\d+$/.test(runId ?? ''))
    throw new Error('Invalid baseline lookup identity')

const api = (path, args = []) =>
    JSON.parse(execFileSync('gh', ['api', repositoryApiPath(repo, path), ...args], { encoding: 'utf8' }))
const currentRun = api(`actions/runs/${runId}`)
const defaultBranch = api('').default_branch
if (currentRun.event !== 'pull_request' || currentRun.head_repository?.full_name !== repo)
    throw new Error('Baseline lookup only supports same-repository pull requests')
const reviewHead = reviewHeadRevision(currentRun)
const prCandidates = api(`commits/${reviewHead}/pulls?per_page=100`, ['--paginate', '--slurp']).flat()
const binding = reviewProvenance(repo, currentRun, prCandidates, (args) =>
    execFileSync('git', args, { encoding: 'utf8' })
)
if (!binding) throw new Error('Unable to resolve the pull request base revision')
const expectedBase = binding.before
if (!/^[a-f0-9]{40}$/.test(expectedBase)) throw new Error('Unable to resolve the merge-base revision')

const artifactsFor = (run) => api(`actions/runs/${run.id}/artifacts?per_page=100`).artifacts ?? []
const publishSource = (run, artifacts) => {
    process.stdout.write(`run_id=${run.id}\n`)
    process.stdout.write(`artifact_name=${artifacts[0].name}\n`)
    process.stdout.write(`baseline_sha=${expectedBase}\n`)
    process.stdout.write(`created_at=${artifacts[0].created_at ?? run.created_at}\n`)
    process.exit(0)
}

// Prefer the exact dev integration run. Its capture jobs remain valid when a
// later publisher or deployment job fails, and the downloaded captures are
// still verified before publication.
const integrationRuns = (api(`actions/runs?head_sha=${expectedBase}&per_page=100`).workflow_runs ?? []).sort(
    (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)
)
for (const run of integrationRuns) {
    if (run.path !== '.github/workflows/screen-library.yml') continue
    const jobs = api(`actions/runs/${run.id}/jobs?per_page=100`).jobs ?? []
    const verified = verifiedExternalBaselineSource({
        run,
        jobs,
        artifacts: artifactsFor(run),
        repository: repo,
        expectedCommit: expectedBase,
        defaultBranch,
    })
    if (verified?.kind === 'integration') publishSource(run, verified.artifacts)
}

// A main-triggered baseline can cover dev revisions whose integration capture
// was unavailable. Search recent trusted runs rather than every repository
// artifact, which is both unbounded and unnecessary.
const branch = encodeURIComponent(defaultBranch)
const baselineRuns = ['push', 'schedule', 'workflow_dispatch']
    .flatMap((event) => api(`actions/runs?branch=${branch}&event=${event}&per_page=100`).workflow_runs ?? [])
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
for (const run of baselineRuns) {
    if (run.path !== '.github/workflows/screen-library-baseline.yml') continue
    const verified = verifiedExternalBaselineSource({
        run,
        artifacts: artifactsFor(run),
        repository: repo,
        expectedCommit: expectedBase,
        defaultBranch,
    })
    if (verified?.kind === 'baseline') publishSource(run, verified.artifacts)
}

throw new Error(`No trusted baseline capture for ${expectedBase} is available in retained artifacts`)
