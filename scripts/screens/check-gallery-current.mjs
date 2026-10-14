import { execFileSync } from 'node:child_process'
import { appendFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const sha = /^[a-f0-9]{40}$/
const deploymentInput = (path) =>
    /^(?:public\/screen-library\/|scripts\/screens\/|\.github\/workflows\/screen-library[^/]*\.ya?ml$|(?:package(?:-lock)?\.json|pnpm-lock\.yaml|\.npmrc|\.nvmrc|\.node-version)$)/.test(
        path
    ) && !/(?:^|\/)(?:__tests__|__mocks__|test-utils)\/|\.(?:test|spec)\.[cm]?[jt]sx?$/.test(path)

export function compatibleGalleryRevision({ queued, current, changedFiles }) {
    if (
        !sha.test(queued ?? '') ||
        !sha.test(current ?? '') ||
        !Array.isArray(changedFiles) ||
        changedFiles.length > 100000 ||
        changedFiles.some(
            (path) =>
                typeof path !== 'string' ||
                !path ||
                path.startsWith('/') ||
                path.includes('\\') ||
                path.split('/').some((part) => !part || part === '..' || part === '.') ||
                /[\x00-\x1f\x7f]/.test(path)
        )
    )
        throw new Error('Cannot prove trusted gallery revision inputs')
    return queued === current || !changedFiles.some(deploymentInput)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const git = (args) => execFileSync('git', args, { encoding: 'utf8', timeout: 60000, maxBuffer: 16 * 1024 * 1024 })
    const queued = process.env.GITHUB_SHA
    const current = git(['rev-parse', 'origin/dev']).trim()
    if (!sha.test(queued ?? '') || !sha.test(current)) throw new Error('Invalid trusted gallery source revisions')
    const changedFiles = git(['diff', '--name-only', '--no-renames', '-z', queued, current, '--'])
        .split('\0')
        .filter(Boolean)
    const compatible = compatibleGalleryRevision({ queued, current, changedFiles })
    console.log(
        compatible
            ? 'Gallery deployment retains the queued exact source; newer unrelated changes are compatible.'
            : 'A newer dev revision changed gallery/deployment inputs; skipping the stale source.'
    )
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `current=${compatible}\n`)
}
