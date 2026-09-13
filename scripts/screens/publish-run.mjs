import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { validateCapture, verifyAsset } from './core.mjs'
import { integrationBase } from './integration.mjs'
import { reviewProvenance } from './review-provenance.mjs'
import { verifyRunIdentity } from './run-identity.mjs'
import { selectCaptureArtifact, selectCapturePairs } from './capture-artifacts.mjs'
import { selectBaselineArtifacts } from './baseline-artifacts.mjs'
import { normalizePublicOrigin } from './public-origin.mjs'
const LOCALES = {
    en: 'English',
    'es-419': 'Español',
    'es-AR': 'Español (Argentina)',
    'pt-BR': 'Português (Brasil)',
}
const localeSlug = (locale) => ({ en: 'en', 'es-419': 'es-419', 'es-AR': 'es-ar', 'pt-BR': 'pt-br' })[locale]
const repo = process.env.REPOSITORY,
    runId = process.env.RUN_ID,
    attempt = process.env.RUN_ATTEMPT
if (!/^[\w.-]+\/[\w.-]+$/.test(repo ?? '') || !/^\d+$/.test(runId ?? '') || !/^\d+$/.test(attempt ?? ''))
    throw new Error('Invalid run identity')
const api = (path) => JSON.parse(execFileSync('gh', ['api', `repos/${repo}/${path}`], { encoding: 'utf8' }))
const run = api(`actions/runs/${runId}`)
verifyRunIdentity(run, repo, Number(runId), Number(attempt))
let expectedBase, pr
if (run.event === 'pull_request') {
    const candidates = JSON.parse(
        execFileSync(
            'gh',
            ['api', `repos/${repo}/commits/${run.head_sha}/pulls?per_page=100`, '--paginate', '--slurp'],
            { encoding: 'utf8' }
        )
    ).flat()
    const binding = reviewProvenance(repo, run, candidates, (args) => execFileSync('git', args, { encoding: 'utf8' }))
    if (!binding) {
        console.log('Superseded or closed PR run; preserving the current report link.')
        process.exit(0)
    }
    pr = binding.pr
    expectedBase = binding.before
} else if (run.event === 'push') {
    if (run.head_branch !== 'dev') throw new Error('Only dev integration pushes may publish')
    expectedBase = integrationBase(repo, run.head_sha)
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

function verifyExternalBaseline(expected) {
    const baselineDir = process.env.SCREEN_LIBRARY_BASELINE_DIR
    const baselineRunId = process.env.SCREEN_LIBRARY_BASELINE_RUN_ID
    const baselineArtifact = process.env.SCREEN_LIBRARY_BASELINE_ARTIFACT
    if (!baselineDir || !/^\d+$/.test(baselineRunId ?? '')) throw new Error('External baseline identity is missing')
    const source = api(`actions/runs/${baselineRunId}`)
    const defaultBranch = api('').default_branch
    const artifacts = api(`actions/runs/${baselineRunId}/artifacts?per_page=100`).artifacts ?? []
    const localeSuffix = '(?:en|es-419|es-AR|pt-BR)'
    const baselineRun =
        source.path === '.github/workflows/screen-library-baseline.yml' &&
        ['push', 'workflow_dispatch'].includes(source.event) &&
        source.head_branch === defaultBranch &&
        artifacts.some((artifact) =>
            new RegExp(`^screen-library-baseline-${expected}-(?:${localeSuffix}-)?[1-9]\\d*$`).test(artifact.name)
        )
    const integrationBaseline =
        source.path === '.github/workflows/screen-library.yml' &&
        source.event === 'push' &&
        artifacts.some((artifact) =>
            new RegExp(`^screen-library-after-(?:${localeSuffix}-)?[1-9]\\d*$`).test(artifact.name)
        )
    if (
        (!baselineRun && !integrationBaseline) ||
        source.status !== 'completed' ||
        source.conclusion !== 'success' ||
        source.head_repository?.full_name !== repo ||
        (integrationBaseline && (source.head_branch !== 'dev' || source.head_sha !== expected))
    )
        throw new Error('External baseline run provenance mismatch')
    const validArtifacts = artifacts.filter((artifact) => {
        const baselineName = new RegExp(`^screen-library-baseline-${expected}-(?:${localeSuffix}-)?[1-9]\\d*$`).test(
            artifact.name
        )
        const integrationName = new RegExp(`^screen-library-after-(?:${localeSuffix}-)?[1-9]\\d*$`).test(artifact.name)
        const created = Date.parse(artifact.created_at ?? '')
        return (
            (baselineName || integrationName) &&
            !artifact.expired &&
            Number.isFinite(created) &&
            Date.now() - created <= 30 * 60 * 60 * 1000
        )
    })
    if (!validArtifacts.length) throw new Error('External baseline artifact is missing or expired')
    if (baselineArtifact && !validArtifacts.some((artifact) => artifact.name === baselineArtifact))
        throw new Error('External baseline artifact identity mismatch')
    return { dir: baselineDir, kind: baselineRun ? 'baseline' : 'integration', artifact: baselineArtifact }
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
    if (capturePairs.length !== Object.keys(LOCALES).length)
        throw new Error('Incomplete locale matrix: every supported locale needs a before/after pair')
} else {
    if (run.event !== 'pull_request' || requiresSameRunBaseline || !process.env.SCREEN_LIBRARY_BASELINE_DIR)
        throw new Error('No complete before/after capture artifact pairs were found in this run')
    const baseline = verifyExternalBaseline(expectedBase)
    const baselineDirNames = readdirSync(baseline.dir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
    const selectedBaselineArtifacts = selectBaselineArtifacts(baselineDirNames, baseline.kind, expectedBase)
    if (selectedBaselineArtifacts.length !== Object.keys(LOCALES).length)
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
    capturePairs = Object.keys(LOCALES).map((locale) => {
        const after = selectCaptureArtifact(captureNames, 'after', hasCapture, locale)
        const before = baselines.get(locale)
        if (!before) throw new Error(`External baseline is missing locale ${locale}`)
        return { locale, attempt: after.attempt, before, after: after.name }
    })
}
const date = run.created_at.slice(0, 10)
const reports = []
for (const capturePair of capturePairs) {
    const captureAttempt = capturePair.attempt
    const dirs = [capturePair.before, capturePair.after]
    const [before, after] = dirs.map((dir) =>
        validateCapture(JSON.parse(readFileSync(join(dir, 'capture.json'), 'utf8')))
    )
    if (before.locale !== capturePair.locale || after.locale !== capturePair.locale)
        throw new Error(`Capture locale identity mismatch for ${capturePair.locale}`)
    if (after.commit !== run.head_sha) throw new Error('Capture does not match triggering run head')
    if (before.commit !== expectedBase)
        throw new Error('Capture baseline does not match verified integration/review/history baseline')
    const slug = localeSlug(after.locale)
    const canonicalPath =
        run.event === 'workflow_dispatch'
            ? `${date}/compare-main-2026-08-27/${slug}/${after.commit}`
            : pr
              ? `${date}/pr-${pr.number}/${slug}/${after.commit}`
              : `${date}/compare-dev/${slug}/${after.commit}`
    const path = `${canonicalPath}/run-${runId}-${attempt}`
    const reportDir = `publication-${slug}`
    execFileSync('node', ['scripts/screens/report.mjs', ...dirs, reportDir], { stdio: 'inherit' })
    const env = {
        ...process.env,
        EXPECTED_HEAD: after.commit,
        EXPECTED_BASE: before.commit,
        DEV_SEQUENCE: String(run.run_number),
        CAPTURE_ATTEMPT: String(captureAttempt),
    }
    execFileSync('node', ['scripts/screens/publish.mjs', reportDir, path], { stdio: 'inherit', env })
    reports.push({ locale: after.locale, path, before, after })
    // Historical reports retain both full source libraries as well as their comparison.
    const libraries =
        run.event === 'workflow_dispatch'
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
        execFileSync(
            'node',
            [
                'scripts/screens/publish.mjs',
                destination,
                `${date}/${branch}/${slug}/${capture.commit}/run-${runId}-${attempt}`,
            ],
            {
                stdio: 'inherit',
                env: {
                    ...env,
                    EXPECTED_HEAD: capture.commit,
                    EXPECTED_BASE: '',
                    CAPTURE_ATTEMPT: String(captureAttempt),
                },
            }
        )
    }
}

if (pr) {
    const marker = '<!-- screen-library -->'
    const publicOrigin = normalizePublicOrigin(process.env.SCREEN_LIBRARY_PUBLIC_URL)
    const body = `${marker}\n${reports
        .map(({ locale, path }) => `[${LOCALES[locale]}](${publicOrigin}/screens/${path}/)`)
        .join(
            ' · '
        )}\n\n[Open screen library dashboard](${publicOrigin}/screens/)\n\n${run.event === 'push' ? 'After merge' : 'Review preview'}: ${reports[0].before.commit} → ${reports[0].after.commit}. ${reports.every(({ before, after }) => before.complete && after.complete) ? 'Capture complete in all locales.' : 'Incomplete capture; unavailable states are listed in the report.'}`
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
