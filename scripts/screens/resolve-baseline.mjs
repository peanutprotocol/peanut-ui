import { execFileSync } from 'node:child_process'

const repo = process.env.REPOSITORY,
    runId = process.env.RUN_ID
const baselineWorkflow = '.github/workflows/screen-library-baseline.yml'
const screenWorkflow = '.github/workflows/screen-library.yml'
const maxAgeMs = 30 * 60 * 60 * 1000

if (!/^[\w.-]+\/[\w.-]+$/.test(repo ?? '') || !/^\d+$/.test(runId ?? ''))
    throw new Error('Invalid baseline lookup identity')

const api = (path, args = []) =>
    JSON.parse(execFileSync('gh', ['api', `repos/${repo}/${path}`, ...args], { encoding: 'utf8' }))
const currentRun = api(`actions/runs/${runId}`)
const defaultBranch = api('').default_branch
if (currentRun.event !== 'pull_request' || currentRun.head_repository?.full_name !== repo)
    throw new Error('Baseline lookup only supports same-repository pull requests')
const prCandidates = api(`commits/${currentRun.head_sha}/pulls?per_page=100`, ['--paginate', '--slurp']).flat()
const binding = prCandidates.find(
    (pr) =>
        pr.state === 'open' &&
        !pr.merged_at &&
        pr.base.ref === 'dev' &&
        pr.head.repo?.full_name === repo &&
        pr.head.ref === currentRun.head_branch &&
        pr.head.sha === currentRun.head_sha
)
const snapshot = currentRun.pull_requests?.find((pr) => pr.number === binding?.number)
const baseSha = snapshot?.base.sha ?? binding?.base.sha
if (!/^[a-f0-9]{40}$/.test(baseSha ?? '')) throw new Error('Unable to resolve the pull request base revision')
const expectedBase = execFileSync('git', ['merge-base', baseSha, currentRun.head_sha], { encoding: 'utf8' }).trim()
if (!/^[a-f0-9]{40}$/.test(expectedBase)) throw new Error('Unable to resolve the merge-base revision')
const pages = api('actions/artifacts?per_page=100', ['--paginate', '--slurp'])
const artifacts = pages.flatMap((page) => page.artifacts ?? [])
const candidates = artifacts
    .filter((artifact) => {
        if (artifact.expired || !artifact.workflow_run?.id) return false
        if (!new RegExp(`^screen-library-baseline-${expectedBase}-[1-9]\\d*$`).test(artifact.name)) return false
        const created = Date.parse(artifact.created_at ?? '')
        return Number.isFinite(created) && Date.now() - created <= maxAgeMs
    })
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))

for (const artifact of candidates) {
    const run = api(`actions/runs/${artifact.workflow_run.id}`)
    const sourceIsTrusted =
        run.path === baselineWorkflow &&
        ['schedule', 'workflow_dispatch'].includes(run.event) &&
        run.head_repository?.full_name === repo &&
        run.head_branch === defaultBranch
    if (!sourceIsTrusted || run.status !== 'completed' || run.conclusion !== 'success')
        continue
    process.stdout.write(`run_id=${run.id}\n`)
    process.stdout.write(`artifact_name=${artifact.name}\n`)
    process.stdout.write(`baseline_sha=${expectedBase}\n`)
    process.stdout.write(`created_at=${artifact.created_at}\n`)
    process.exit(0)
}

// A successful dev integration run is also a trusted baseline source. This
// keeps a newly merged dev revision usable before the next scheduled run.
const integrationCandidates = artifacts
    .filter((artifact) => {
        if (artifact.expired || !artifact.workflow_run?.id) return false
        if (!/^screen-library-after-[1-9]\d*$/.test(artifact.name)) return false
        const created = Date.parse(artifact.created_at ?? '')
        return Number.isFinite(created) && Date.now() - created <= maxAgeMs
    })
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))

for (const artifact of integrationCandidates) {
    const run = api(`actions/runs/${artifact.workflow_run.id}`)
    const sourceIsTrusted =
        run.path === screenWorkflow &&
        run.event === 'push' &&
        run.head_branch === 'dev' &&
        run.head_repository?.full_name === repo
    if (!sourceIsTrusted || run.status !== 'completed' || run.conclusion !== 'success' || run.head_sha !== expectedBase)
        continue
    process.stdout.write(`run_id=${run.id}\n`)
    process.stdout.write(`artifact_name=${artifact.name}\n`)
    process.stdout.write(`baseline_sha=${run.head_sha}\n`)
    process.stdout.write(`created_at=${artifact.created_at}\n`)
    process.exit(0)
}

throw new Error(`No trusted baseline capture for ${expectedBase} is available within 30 hours`)
