import { execFileSync } from 'node:child_process'
import { ghApiSync } from './gh-api.mjs'
import { existsSync, readdirSync } from 'node:fs'
import { repositoryApiPath } from './repository-api.mjs'
import {
    bindReleaseReviewEvent,
    reviewHeadRevision,
    reviewProvenance,
    reviewPullRequest,
} from './review-provenance.mjs'
import { verifiedExternalBaselineSource } from './baseline-runs.mjs'
import { parseCaptureArtifact } from './capture-artifacts.mjs'
import { CAPTURE_LOCALES } from './capture-locales.mjs'
import { selectBeforeHarness } from './before-harness.mjs'

const repo = process.env.REPOSITORY,
    runId = process.env.RUN_ID
if (!/^[\w.-]+\/[\w.-]+$/.test(repo ?? '') || !/^\d+$/.test(runId ?? ''))
    throw new Error('Invalid baseline lookup identity')

// A page of 100 workflow runs is over 1 MB, execFileSync's default buffer (ENOBUFS).
const api = (path, args = []) =>
    JSON.parse(
        ghApiSync([repositoryApiPath(repo, path), ...args], {
            encoding: 'utf8',
            maxBuffer: 64 * 1024 * 1024,
        })
    )
const currentRun = bindReleaseReviewEvent(repo, api(`actions/runs/${runId}`))
const currentCaptures = process.argv.includes('--current')
if (currentCaptures && currentRun.event !== 'pull_request') {
    process.stdout.write('mode=current\n')
    process.exit(0) // Push captures retain the publisher's existing provenance checks.
}
if (currentRun.event !== 'pull_request' || currentRun.head_repository?.full_name !== repo)
    throw new Error('Baseline lookup only supports same-repository pull requests')
const reviewHead = reviewHeadRevision(currentRun)
const snapshot = currentRun.pull_requests?.[0]
const releasePreview = snapshot?.base.ref === 'main'
const prCandidates = releasePreview
    ? [api(`pulls/${snapshot.number}`)]
    : api(`commits/${reviewHead}/pulls?per_page=100`, ['--paginate', '--slurp']).flat()
const pr = reviewPullRequest(repo, currentRun, prCandidates)
if (pr?.state === 'closed' || pr?.merged_at) {
    process.stderr.write('::notice::The exact pull request for this run is closed or merged; skipping publication.\n')
    process.stdout.write('mode=skip\n')
    process.exit(0)
}
const binding = reviewProvenance(repo, currentRun, prCandidates, (args) =>
    execFileSync('git', args, { encoding: 'utf8' })
)
if (!binding && releasePreview) {
    process.stderr.write('::notice::Release pull request is no longer current; skipping publication.\n')
    process.stdout.write('mode=skip\n')
    process.exit(0)
}
if (!binding) throw new Error('Unable to resolve the pull request base revision')
const expectedBase = binding.before
if (!/^[a-f0-9]{40}$/.test(expectedBase)) throw new Error('Unable to resolve the merge-base revision')
if (currentCaptures) {
    process.stdout.write('mode=current\n')
    process.exit(0)
}
const beforeHarnessMode = selectBeforeHarness({ before: expectedBase, after: reviewHead })
const defaultBranch = api('').default_branch

// The publisher still requires every locale its trusted plan needs; this only sizes the search.
const capturedLocales = existsSync('incoming')
    ? CAPTURE_LOCALES.filter((locale) =>
          readdirSync('incoming').some((name) => {
              const artifact = parseCaptureArtifact(name)
              return artifact?.side === 'after' && artifact.locale === locale
          })
      )
    : []
const locales = capturedLocales.length ? capturedLocales : CAPTURE_LOCALES
const artifactsFor = (run) => api(`actions/runs/${run.id}/artifacts?per_page=100`).artifacts ?? []
const publishSource = (run, artifacts) => {
    process.stdout.write('mode=external\n')
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
        locales,
        beforeHarnessMode,
    })
    if (verified?.kind === 'integration') publishSource(run, verified.artifacts)
}
if (beforeHarnessMode === 'base')
    throw new Error(`No trusted integration capture with its own harness for ${expectedBase} is retained`)

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
        locales,
        beforeHarnessMode,
    })
    if (verified?.kind === 'baseline') publishSource(run, verified.artifacts)
}

throw new Error(`No trusted baseline capture for ${expectedBase} is available in retained artifacts`)
