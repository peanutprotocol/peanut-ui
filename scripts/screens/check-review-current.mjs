import { execFileSync } from 'node:child_process'
import { appendFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { repositoryApiPath } from './repository-api.mjs'

export function currentCaptureReview(pr, { repository, head, base }) {
    return (
        pr?.state === 'open' &&
        pr.head?.repo?.full_name === repository &&
        pr.head?.sha === head &&
        pr.base?.ref === 'dev' &&
        pr.base?.sha === base
    )
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const { EVENT: event, REPOSITORY: repository, PR_NUMBER: number, PR_HEAD: head, PR_BASE: base } = process.env
    let current = true
    if (event === 'pull_request') {
        if (
            !/^[1-9]\d*$/.test(number ?? '') ||
            !/^[a-f0-9]{40}$/.test(head ?? '') ||
            !/^[a-f0-9]{40}$/.test(base ?? '')
        )
            throw new Error('Invalid exact PR revision for capture preflight')
        const pr = JSON.parse(
            execFileSync('gh', ['api', repositoryApiPath(repository, `pulls/${number}`)], {
                encoding: 'utf8',
                timeout: 60000,
                maxBuffer: 4 * 1024 * 1024,
            })
        )
        current = currentCaptureReview(pr, { repository, head, base })
    }
    console.log(
        current
            ? 'Capture preflight: current revision'
            : 'Capture preflight: closed or superseded PR; no additional before capture'
    )
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `current=${current}\n`)
}
