import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs'
import { join } from 'node:path'
import { validateCapture, verifyAsset } from './core.mjs'
import { integrationBase } from './integration.mjs'
import { reviewProvenance } from './review-provenance.mjs'
import { verifyRunIdentity } from './run-identity.mjs'
const repo = process.env.REPOSITORY,
    runId = process.env.RUN_ID,
    attempt = process.env.RUN_ATTEMPT
if (!/^[\w.-]+\/[\w.-]+$/.test(repo ?? '') || !/^\d+$/.test(runId ?? '') || !/^\d+$/.test(attempt ?? ''))
    throw new Error('Invalid run identity')
const api = (path) => JSON.parse(execFileSync('gh', ['api', `repos/${repo}/${path}`], { encoding: 'utf8' }))
const run = api(`actions/runs/${runId}`)
verifyRunIdentity(run, repo, Number(runId), Number(attempt))
const dirs = ['before', 'after'].map((side) => `incoming/screen-library-${side}-${attempt}`)
const [before, after] = dirs.map((dir) => validateCapture(JSON.parse(readFileSync(join(dir, 'capture.json'), 'utf8'))))
if (after.commit !== run.head_sha) throw new Error('Capture does not match triggering run head')
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
if (before.commit !== expectedBase)
    throw new Error('Capture baseline does not match verified integration/review/history baseline')
const date = run.created_at.slice(0, 10)
const canonicalPath =
    run.event === 'workflow_dispatch'
        ? `${date}/compare-main-2026-08-27/${after.commit}`
        : pr
          ? `${date}/pr-${pr.number}/${after.commit}`
          : `${date}/compare-dev/${after.commit}`
const path = `${canonicalPath}/run-${runId}-${attempt}`
execFileSync('node', ['scripts/screens/report.mjs', ...dirs, 'publication'], { stdio: 'inherit' })
const env = {
    ...process.env,
    EXPECTED_HEAD: after.commit,
    EXPECTED_BASE: before.commit,
    DEV_SEQUENCE: String(run.run_number),
}
execFileSync('node', ['scripts/screens/publish.mjs', 'publication', path], { stdio: 'inherit', env })
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
    const destination = `library-${branch}`
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
        ['scripts/screens/publish.mjs', destination, `${date}/${branch}-${capture.commit}/run-${runId}-${attempt}`],
        {
            stdio: 'inherit',
            env: { ...env, EXPECTED_HEAD: capture.commit, EXPECTED_BASE: '' },
        }
    )
}

if (pr) {
    const marker = '<!-- screen-library -->'
    const body = `${marker}\n[Open screen comparison](${process.env.SCREEN_LIBRARY_PUBLIC_URL}/screens/${path}/)\n\n${run.event === 'push' ? 'After merge' : 'Review preview'}: ${before.commit} → ${after.commit}. ${before.complete && after.complete ? 'Capture complete.' : 'Incomplete capture; unavailable states are listed in the report.'}`
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
