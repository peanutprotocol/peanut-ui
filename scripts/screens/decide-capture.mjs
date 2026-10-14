import { execFileSync } from 'node:child_process'
import { appendFileSync } from 'node:fs'
import { knownNonvisual, galleryMaintenanceChange, galleryIndexChange } from './capture-plan.mjs'

const { BEFORE: before, AFTER: after, EVENT: event, BRANCH: branch } = process.env
if (!/^[a-f0-9]{40}$/.test(before ?? '') || !/^[a-f0-9]{40}$/.test(after ?? ''))
    throw new Error('Capture planning requires immutable revisions')
const changedFiles = execFileSync('git', ['diff', '--name-only', '--no-renames', '-z', before, after, '--'], {
    encoding: 'utf8',
    timeout: 60000,
    maxBuffer: 16 * 1024 * 1024,
})
    .split('\0')
    .filter(Boolean)
let mode = event !== 'workflow_dispatch' && changedFiles.length && changedFiles.every(knownNonvisual) ? 'skip' : 'full'
let only = ''
let gallery = false
let capabilities
try {
    capabilities = JSON.parse(
        execFileSync('git', ['show', 'origin/dev:scripts/screens/capture-capabilities.json'], {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
            timeout: 60000,
        })
    )
} catch {
    console.log('Trusted dev publisher capabilities unavailable; retaining legacy-compatible execution.')
}
gallery =
    event === 'push' &&
    branch === 'dev' &&
    mode === 'skip' &&
    capabilities?.galleryMaintenance === 1 &&
    changedFiles.some(galleryMaintenanceChange)
if (
    event === 'push' &&
    branch === 'dev' &&
    mode === 'skip' &&
    changedFiles.some(galleryMaintenanceChange) &&
    capabilities?.galleryMaintenance !== 1
) {
    mode = 'full'
    console.log('Trusted gallery-only workflow unavailable; retaining legacy capture/publication delivery.')
}
if (process.argv.includes('--impact') && mode !== 'skip' && event === 'pull_request') {
    const capable = capabilities?.scopedCapture === 1
    if (!capable) {
        console.log('Trusted dev publisher has no scoped-capture capability; retaining full legacy pairs.')
    }
    if (capable) {
        const { planRevisionCapture } = await import('./capture-impact.mjs')
        const plan = planRevisionCapture({ event, branch, before, after })
        console.log(JSON.stringify(plan))
        mode = plan.mode
        only = mode === 'targeted' ? plan.screenIds.join(',') : ''
    }
}
console.log(`Capture decision: ${mode}; changed paths: ${changedFiles.length}`)
if (process.env.GITHUB_OUTPUT)
    appendFileSync(
        process.env.GITHUB_OUTPUT,
        `mode=${mode}\nonly=${only}\ngallery=${gallery}\nrefresh_indexes=${changedFiles.some(galleryIndexChange)}\ndeploy_gallery=${changedFiles.some((path) => galleryMaintenanceChange(path) && !galleryIndexChange(path))}\n`
    )
