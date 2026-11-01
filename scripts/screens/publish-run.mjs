import { execFileSync } from 'node:child_process'
import { appendFileSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { createStorage } from './cloudflare-storage.mjs'
import { validateCapture, verifyAsset } from './core.mjs'
import { mainRevisions, pushRevisions } from './capture-revisions.mjs'
import { reviewHeadRevision, reviewProvenance } from './review-provenance.mjs'
import { verifyRunIdentity } from './run-identity.mjs'
import { parseCaptureArtifact, selectCaptureArtifact, selectCapturePairs } from './capture-artifacts.mjs'
import { selectBaselineArtifacts } from './baseline-artifacts.mjs'
import { verifiedExternalBaselineSource } from './baseline-runs.mjs'
import { normalizePublicOrigin } from './public-origin.mjs'
import { existingAssetPaths, publishReport } from './publish.mjs'
import { repositoryApiPath } from './repository-api.mjs'
import { evaluateZeroDifferenceGate, reviewableComparison } from './zero-difference-gate.mjs'
import { planRevisionCapture } from './capture-impact.mjs'
import { canonicalScope } from './capture-scope.mjs'
import { verifyReusedBaseline } from './verify-reused-baseline.mjs'
import { captureFixtures } from './capture-fixtures.mjs'
import { ALL_LOCALES_LABEL, missingLocales, planCaptureLocales } from './capture-locales.mjs'
const LOCALES = {
    en: 'English',
    'es-419': 'Español',
    'es-AR': 'Español (Argentina)',
    'pt-BR': 'Português (Brasil)',
}
const visualChangeStatuses = new Set(['changed', 'added', 'new', 'removed'])
const localeSlug = (locale) => ({ en: 'en', 'es-419': 'es-419', 'es-AR': 'es-ar', 'pt-BR': 'pt-br' })[locale]

async function mapBounded(values, operation, limit = 2) {
    const output = new Array(values.length)
    let cursor = 0
    await Promise.all(
        Array.from({ length: Math.min(limit, values.length) }, async () => {
            while (cursor < values.length) {
                const index = cursor++
                output[index] = await operation(values[index])
            }
        })
    )
    return output
}

function recordPublished(value) {
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `published=${value}\n`)
}
const repo = process.env.REPOSITORY,
    runId = process.env.RUN_ID,
    attempt = process.env.RUN_ATTEMPT
if (!/^[\w.-]+\/[\w.-]+$/.test(repo ?? '') || !/^\d+$/.test(runId ?? '') || !/^\d+$/.test(attempt ?? ''))
    throw new Error('Invalid run identity')
const api = (path) =>
    JSON.parse(
        execFileSync('gh', ['api', repositoryApiPath(repo, path)], {
            encoding: 'utf8',
            timeout: 60000,
            maxBuffer: 64 * 1024 * 1024,
        })
    )
const run = api(`actions/runs/${runId}`)
verifyRunIdentity(run, repo, Number(runId), Number(attempt))
const mainRelease = run.head_branch === 'main' && ['push', 'workflow_dispatch'].includes(run.event)
let expectedBase, pr
let expectedHead = run.event === 'pull_request' ? reviewHeadRevision(run) : run.head_sha
if (mainRelease) {
    const refs = mainRevisions({
        event: run.event,
        head: run.head_sha,
        before: run.event === 'push' ? process.env.PUSH_BEFORE : process.env.MAIN_BEFORE,
        after: process.env.MAIN_AFTER,
    })
    expectedBase = refs.before
    expectedHead = refs.after
} else if (run.event === 'pull_request') {
    const reviewHead = reviewHeadRevision(run)
    const candidates = JSON.parse(
        execFileSync('gh', ['api', `repos/${repo}/commits/${reviewHead}/pulls?per_page=100`, '--paginate', '--slurp'], {
            encoding: 'utf8',
        })
    ).flat()
    const binding = reviewProvenance(repo, run, candidates, (args) => execFileSync('git', args, { encoding: 'utf8' }))
    if (!binding) {
        console.log('Superseded or closed PR run; preserving the current report link.')
        recordPublished(false)
        process.exit(0)
    }
    pr = binding.pr
    expectedBase = binding.before
} else if (run.event === 'push') {
    if (run.head_branch !== 'dev') throw new Error('Only dev integration pushes may publish')
    expectedBase = pushRevisions({ head: run.head_sha, before: process.env.PUSH_BEFORE }).before
    pr = JSON.parse(
        execFileSync(
            'gh',
            ['api', `repos/${repo}/commits/${run.head_sha}/pulls?per_page=100`, '--paginate', '--slurp'],
            { encoding: 'utf8' }
        )
    )
        .flat()
        .find((p) => p.merged_at && p.base.ref === 'dev' && p.merge_commit_sha === run.head_sha)
} else if (run.event === 'workflow_dispatch') {
    if (run.head_branch !== 'dev') throw new Error('Historical dispatch must target dev')
    // v1's historical request is fixed; arbitrary artifact-provided refs are not trusted.
    expectedBase = execFileSync(
        'git',
        ['rev-list', '--first-parent', '-1', '--before=2026-08-28T00:00:00+01:00', 'origin/main'],
        { encoding: 'utf8' }
    ).trim()
} else throw new Error('Unsupported triggering event')

// Include both sides of a rename so moving a UI file outside src cannot hide its removal.
const changedFiles =
    !mainRelease && ['pull_request', 'push'].includes(run.event)
        ? execFileSync('git', ['diff', '--name-only', '--no-renames', '-z', expectedBase, expectedHead, '--'], {
              encoding: 'utf8',
              maxBuffer: 64 * 1024 * 1024,
          })
              .split('\0')
              .filter(Boolean)
        : []
// Recomputed from the exact revisions and current PR labels, never from the caller's matrix.
const localePlan = planCaptureLocales({
    event: run.event,
    branch: run.event === 'pull_request' ? pr.base.ref : run.head_branch,
    changedFiles,
    labels: run.event === 'pull_request' ? (pr.labels ?? []).map((label) => label?.name) : [],
})
console.log(`Required Screen Library locales: ${localePlan.locales.join(', ')} (${localePlan.reasons.join('; ')})`)

function verifyExternalBaseline(expected, locales) {
    const baselineDir = process.env.SCREEN_LIBRARY_BASELINE_DIR
    const baselineRunId = process.env.SCREEN_LIBRARY_BASELINE_RUN_ID
    const baselineArtifact = process.env.SCREEN_LIBRARY_BASELINE_ARTIFACT
    if (!baselineDir || !/^\d+$/.test(baselineRunId ?? '')) throw new Error('External baseline identity is missing')
    const source = api(`actions/runs/${baselineRunId}`)
    const defaultBranch = api('').default_branch
    const artifacts = api(`actions/runs/${baselineRunId}/artifacts?per_page=100`).artifacts ?? []
    const jobs =
        source.path === '.github/workflows/screen-library.yml'
            ? (api(`actions/runs/${baselineRunId}/jobs?per_page=100`).jobs ?? [])
            : []
    const verified = verifiedExternalBaselineSource({
        run: source,
        jobs,
        artifacts,
        repository: repo,
        expectedCommit: expected,
        defaultBranch,
        locales,
    })
    if (!verified) throw new Error('External baseline run provenance mismatch')
    const validArtifacts = verified.artifacts
    if (baselineArtifact && !validArtifacts.some((artifact) => artifact.name === baselineArtifact))
        throw new Error('External baseline artifact identity mismatch')
    return { dir: baselineDir, kind: verified.kind, artifact: baselineArtifact }
}

const captureNames = readdirSync('incoming')
const hasCapture = (name) => {
    if (!existsSync(join('incoming', name, 'capture.json'))) return false
    try {
        validateCapture(JSON.parse(readFileSync(join('incoming', name, 'capture.json'), 'utf8')))
        return true
    } catch {
        return false
    }
}
const requiresSameRunBaseline = captureNames.some((name) => {
    const requirement = join('incoming', name, 'screen-library-requirement.json')
    if (!existsSync(requirement)) return false
    try {
        return JSON.parse(readFileSync(requirement, 'utf8')).requireSameRunBaseline === true
    } catch {
        throw new Error('Invalid screen library baseline requirement')
    }
})
let capturePairs = selectCapturePairs(captureNames, ({ before, after }) => hasCapture(before) && hasCapture(after))
if (capturePairs.length) {
    const missing = missingLocales(
        localePlan.locales,
        capturePairs.map((pair) => pair.locale)
    )
    if (missing.length)
        throw new Error(`Incomplete locale matrix: missing before/after pairs for ${missing.join(', ')}`)
} else {
    if (run.event !== 'pull_request' || requiresSameRunBaseline || !process.env.SCREEN_LIBRARY_BASELINE_DIR)
        throw new Error('No complete before/after capture artifact pairs were found in this run')
    const afterLocales = Object.keys(LOCALES).filter((locale) =>
        captureNames.some((name) => {
            const artifact = parseCaptureArtifact(name)
            return artifact?.side === 'after' && artifact.locale === locale
        })
    )
    const missing = missingLocales(localePlan.locales, afterLocales)
    if (missing.length) throw new Error(`Incomplete locale matrix: missing after captures for ${missing.join(', ')}`)
    const baseline = verifyExternalBaseline(expectedBase, afterLocales)
    const baselineDirNames = readdirSync(baseline.dir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
    const selectedBaselineArtifacts = selectBaselineArtifacts(baselineDirNames, baseline.kind, expectedBase).filter(
        (artifact) => afterLocales.includes(artifact.locale)
    )
    if (selectedBaselineArtifacts.length !== afterLocales.length)
        throw new Error('External baseline is missing one or more locale artifacts')
    if (baseline.artifact && !baselineDirNames.includes(baseline.artifact))
        throw new Error('External baseline artifact was not downloaded')
    const baselines = new Map()
    for (const artifact of selectedBaselineArtifacts) {
        const dir = join(baseline.dir, artifact.name)
        if (!existsSync(join(dir, 'capture.json')))
            throw new Error(`External baseline artifact is missing capture.json: ${artifact.name}`)
        const capture = validateCapture(JSON.parse(readFileSync(join(dir, 'capture.json'), 'utf8')))
        if (capture.locale !== artifact.locale || capture.commit !== expectedBase)
            throw new Error(`External baseline artifact identity mismatch: ${artifact.name}`)
        baselines.set(capture.locale, dir)
    }
    capturePairs = afterLocales.map((locale) => {
        const after = selectCaptureArtifact(captureNames, 'after', hasCapture, locale)
        const before = baselines.get(locale)
        if (!before) throw new Error(`External baseline is missing locale ${locale}`)
        return { locale, attempt: after.attempt, before, after: after.name }
    })
}
const date = run.created_at.slice(0, 10)
const reports = []
const publications = []
let trustedPlan
for (const capturePair of capturePairs) {
    const captureAttempt = capturePair.attempt
    const dirs = [capturePair.before, capturePair.after]
    const [before, after] = dirs.map((dir) =>
        validateCapture(JSON.parse(readFileSync(join(dir, 'capture.json'), 'utf8')))
    )
    if (before.locale !== capturePair.locale || after.locale !== capturePair.locale)
        throw new Error(`Capture locale identity mismatch for ${capturePair.locale}`)
    if (after.commit !== expectedHead) throw new Error('Capture does not match triggering run head')
    if (before.commit !== expectedBase)
        throw new Error('Capture baseline does not match verified integration/review/history baseline')
    if (after.scope || before.scope) {
        if (run.event !== 'pull_request') throw new Error('Scoped captures cannot replace full integration libraries')
        trustedPlan ??= planRevisionCapture({
            event: run.event,
            branch: pr.base.ref,
            before: expectedBase,
            after: expectedHead,
        })
        if (
            trustedPlan.mode !== 'targeted' ||
            !after.scope ||
            JSON.stringify(canonicalScope(after.scope)) !== JSON.stringify(canonicalScope(trustedPlan))
        )
            throw new Error('Artifact scope does not match the trusted exact-revision impact plan')
    }
    const receiptPath = join(dirs[0], 'baseline-source.json')
    if (existsSync(receiptPath))
        verifyReusedBaseline({
            receipt: JSON.parse(readFileSync(receiptPath, 'utf8')),
            beforeBytes: readFileSync(join(dirs[0], 'capture.json')),
            after,
            expectedCommit: expectedBase,
            expectedFixtures: after.fixtureSource
                ? captureFixtures('.', { revision: expectedBase }).fixtures
                : undefined,
            repository: repo,
            api,
            download: (sourceRun, artifact, destination) =>
                execFileSync(
                    'gh',
                    ['run', 'download', sourceRun, '--repo', repo, '--name', artifact, '--dir', destination],
                    { stdio: 'inherit', timeout: 180000 }
                ),
        })
    const slug = localeSlug(after.locale)
    const canonicalPath = mainRelease
        ? `${date}/compare-main/${slug}/${after.commit}`
        : run.event === 'workflow_dispatch'
          ? `${date}/compare-main-2026-08-27/${slug}/${after.commit}`
          : run.event === 'push'
            ? `${date}/compare-dev/${slug}/${after.commit}`
            : pr
              ? `${date}/pr-${pr.number}/${slug}/${after.commit}`
              : `${date}/compare-dev/${slug}/${after.commit}`
    const path = `${canonicalPath}/run-${runId}-${attempt}`
    const reportDir = `publication-${slug}`
    execFileSync('node', ['scripts/screens/report.mjs', ...dirs, reportDir], { stdio: 'inherit' })
    const comparison = JSON.parse(readFileSync(join(reportDir, 'manifest.json'), 'utf8'))
    const changedScreens = comparison.screens.filter((screen) => visualChangeStatuses.has(screen.status)).length
    const env = {
        ...process.env,
        EXPECTED_HEAD: after.commit,
        EXPECTED_BASE: before.commit,
        DEV_SEQUENCE: String(run.run_number),
        CAPTURE_ATTEMPT: String(captureAttempt),
        SOURCE_BRANCH: run.event === 'pull_request' ? pr.head.ref : run.head_branch,
        PR_NUMBER: pr ? String(pr.number) : '',
        CHANGED_SCREENS: String(changedScreens),
    }
    publications.push({ inputDir: reportDir, reportPath: path, env })
    reports.push({
        locale: after.locale,
        path,
        before,
        after,
        complete: comparison.scope ? false : reviewableComparison(comparison),
        ...(comparison.scope ? { scope: comparison.scope, scopeComplete: reviewableComparison(comparison) } : {}),
        changedScreens,
    })
    // Historical reports retain both full source libraries as well as their comparison.
    const libraries = mainRelease
        ? [[after, dirs[1], 'main']]
        : run.event === 'workflow_dispatch'
          ? [
                [before, dirs[0], 'main'],
                [after, dirs[1], 'dev'],
            ]
          : run.event === 'push'
            ? [[after, dirs[1], 'dev']]
            : []
    for (const [capture, source, branch] of libraries) {
        const destination = `library-${branch}-${slug}`
        mkdirSync(`${destination}/assets`, { recursive: true })
        for (const screen of capture.screens)
            if (screen.status === 'captured')
                for (const name of [screen.image, screen.thumbnail]) {
                    verifyAsset(join(source, 'assets'), name)
                    copyFileSync(join(source, 'assets', name), join(destination, 'assets', name))
                }
        writeFileSync(`${destination}/manifest.json`, JSON.stringify(capture))
        publications.push({
            inputDir: destination,
            reportPath: `${date}/${branch}/${slug}/${capture.commit}/run-${runId}-${attempt}`,
            env: {
                ...env,
                EXPECTED_HEAD: capture.commit,
                EXPECTED_BASE: '',
                CAPTURE_ATTEMPT: String(captureAttempt),
                SOURCE_BRANCH: branch,
            },
        })
    }
}

// Every report and image remains immutable and retained. Share one R2 client,
// one existing-asset snapshot plus shared conversion and write maps across the
// run so duplicate content is never converted or uploaded twice. Shared indexes
// are refreshed by the separately serialized index job after all entry markers
// are committed.
const storage = await createStorage()
const knownAssets = await existingAssetPaths(storage)
const assetWrites = new Map()
const assetConversions = new Map()
await mapBounded(publications, ({ inputDir, reportPath, env }) =>
    publishReport({
        inputDir,
        reportPath,
        env,
        storage,
        knownAssets,
        assetWrites,
        assetConversions,
        updateSharedIndexes: false,
    })
)
recordPublished(true)

let coverageGate
if (run.event === 'pull_request' && pr) {
    coverageGate = evaluateZeroDifferenceGate({
        event: run.event,
        changedFiles,
        reports,
        exception: pr.body ?? '',
        locales: localePlan.locales,
        ...(trustedPlan ? { plan: trustedPlan } : {}),
    })
    console.log(`Screen Library coverage: ${coverageGate.ok ? 'pass' : 'fail'} — ${coverageGate.reason}`)
}

if (pr) {
    const marker = '<!-- screen-library -->'
    const publicOrigin = normalizePublicOrigin(process.env.SCREEN_LIBRARY_PUBLIC_URL)
    const everyLocale = reports.length === Object.keys(LOCALES).length
    const localeScope = everyLocale ? 'all locales' : reports.map(({ locale }) => LOCALES[locale]).join(', ')
    const localeNote =
        everyLocale || run.event !== 'pull_request'
            ? ''
            : ` Other locales were not captured; add the \`${ALL_LOCALES_LABEL}\` label and re-run Screen library to include them.`
    const coverageDescription = `${
        trustedPlan
            ? `Targeted review: ${trustedPlan.screenIds.length} states across ${[...new Set(reports[0].after.screens.map((screen) => screen.flow))].sort().join(', ')} in ${localeScope}. Other flows were not captured. ${reports.every(({ scopeComplete }) => scopeComplete) ? 'Selected scope complete.' : 'Selected scope incomplete; review its gaps and failures.'}`
            : reports.every(({ complete }) => complete)
              ? `Reviewable capture in ${localeScope}; newly registered states are marked in the report.`
              : 'Incomplete capture; unavailable states are listed in the report.'
    }${localeNote}`
    const body = `${marker}\n${reports
        .map(({ locale, path }) => `[${LOCALES[locale]}](${publicOrigin}/screens/${path}/)`)
        .join(
            ' · '
        )}\n\n[Open screen library dashboard](${publicOrigin}/screens/)\n\n${run.event === 'push' ? 'After merge' : 'Review preview'}: ${reports[0].before.commit} → ${reports[0].after.commit}. ${coverageDescription}${coverageGate ? `\n\nScreen Library coverage: ${coverageGate.ok ? 'pass' : 'fail'} — ${coverageGate.reason}` : ''}`
    const comments = JSON.parse(
        execFileSync(
            'gh',
            ['api', `repos/${repo}/issues/${pr.number}/comments?per_page=100`, '--paginate', '--slurp'],
            { encoding: 'utf8' }
        )
    ).flat()
    const existing = comments.find((c) => c.user.login === 'github-actions[bot]' && c.body.startsWith(marker))
    execFileSync(
        'gh',
        [
            'api',
            existing ? `repos/${repo}/issues/comments/${existing.id}` : `repos/${repo}/issues/${pr.number}/comments`,
            '-X',
            existing ? 'PATCH' : 'POST',
            '--input',
            '-',
        ],
        { input: JSON.stringify({ body }), stdio: ['pipe', 'ignore', 'inherit'] }
    )
}
if (coverageGate && !coverageGate.ok) throw new Error(coverageGate.reason)
