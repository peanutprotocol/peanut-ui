/** Trusted main-triggered baseline publisher. Downloaded capture bytes are data, never code. */
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ADDITIONAL_PROFILES, verifyBaselineMatrix } from './baseline-viewports.mjs'
import { verifyAsset } from './core.mjs'
import { repositoryApiPath } from './repository-api.mjs'

const {
    REPOSITORY: repository,
    RUN_ID: runId,
    RUN_ATTEMPT: runAttempt,
    TRIGGER_SHA: triggerSha,
    EXPECTED_DEV_SHA: devSha,
} = process.env
if (
    repository !== 'peanutprotocol/peanut-ui' ||
    !/^\d+$/.test(runId ?? '') ||
    !/^\d+$/.test(runAttempt ?? '') ||
    !/^[a-f0-9]{40}$/.test(triggerSha ?? '') ||
    !/^[a-f0-9]{40}$/.test(devSha ?? '')
)
    throw new Error('Invalid baseline publication environment')
const api = (path) => JSON.parse(execFileSync('gh', ['api', repositoryApiPath(repository, path)], { encoding: 'utf8' }))
const run = api(`actions/runs/${runId}`)
if (
    run.id !== Number(runId) ||
    run.run_attempt !== Number(runAttempt) ||
    run.head_repository?.full_name !== repository ||
    run.path !== '.github/workflows/screen-library-baseline.yml' ||
    !['push', 'workflow_dispatch'].includes(run.event) ||
    run.head_branch !== 'main' ||
    run.head_sha !== triggerSha ||
    !/^\d{4}-\d{2}-\d{2}T/.test(run.created_at ?? '')
)
    throw new Error('Baseline run provenance mismatch')
const artifacts = api(`actions/runs/${runId}/artifacts?per_page=100`).artifacts ?? []
const captures = verifyBaselineMatrix({
    sha: devSha,
    attempt: Number(runAttempt),
    artifacts,
    readCapture: (name) => JSON.parse(readFileSync(join('incoming', name, 'capture.json'), 'utf8')),
})
// Check all assets before making any immutable publication. The default-size
// artifact is retained for PR comparisons; only the three extra sizes publish here.
for (const { name, capture } of captures) {
    const assets = join('incoming', name, 'assets')
    for (const screen of capture.screens)
        if (screen.status === 'captured')
            for (const asset of new Set([screen.image, screen.thumbnail])) verifyAsset(assets, asset, capture)
}
const date = run.created_at.slice(0, 10)
const staging = mkdtempSync(join(tmpdir(), 'peanut-screen-viewports-'))
try {
    for (const { name, slug, profile, capture } of captures.filter((item) =>
        ADDITIONAL_PROFILES.includes(item.profile)
    )) {
        const source = join('incoming', name)
        const destination = join(staging, `${slug}-${profile}`)
        mkdirSync(join(destination, 'assets'))
        for (const screen of capture.screens)
            if (screen.status === 'captured')
                for (const asset of new Set([screen.image, screen.thumbnail])) {
                    const target = join(destination, 'assets', asset)
                    if (!existsSync(target)) copyFileSync(join(source, 'assets', asset), target)
                }
        writeFileSync(join(destination, 'manifest.json'), JSON.stringify(capture))
        execFileSync(
            'node',
            [
                'scripts/screens/publish.mjs',
                destination,
                `${date}/dev/${slug}/${profile}/${devSha}/run-${runId}-${runAttempt}`,
            ],
            {
                stdio: 'inherit',
                env: {
                    ...process.env,
                    EXPECTED_HEAD: devSha,
                    DEV_SEQUENCE: String(run.run_number),
                    CAPTURE_ATTEMPT: String(runAttempt),
                    SOURCE_BRANCH: 'dev',
                },
            }
        )
    }
} finally {
    rmSync(staging, { recursive: true, force: true })
}
