import { execFileSync } from 'node:child_process'
const shaPattern = /^[a-f0-9]{40}$/
export function integrationBase(repository, head, execute = execFileSync) {
    if (!/^[\w.-]+\/[\w.-]+$/.test(repository) || !shaPattern.test(head))
        throw new Error('Invalid integration identity')
    const api = (path, args = []) =>
        execute('gh', ['api', `repos/${repository}/${path}`, ...args], { encoding: 'utf8' })
    const commit = JSON.parse(api(`commits/${head}`))
    if (commit.parents.length !== 1) return commit.parents[0].sha
    const prs = JSON.parse(api(`commits/${head}/pulls?per_page=100`, ['--paginate', '--slurp']))
        .flat()
        .filter((p) => p.merged_at && p.merge_commit_sha === head && p.base.ref === 'dev')
    if (prs.length !== 1) return commit.parents[0].sha
    const original = JSON.parse(api(`pulls/${prs[0].number}/commits?per_page=100`, ['--paginate', '--slurp'])).flat()
    if (original.length <= 1) return commit.parents[0].sha
    const patchId = (sha) =>
        execute('git', ['patch-id', '--stable'], {
            input: api(`commits/${sha}`, ['-H', 'Accept: application/vnd.github.diff']),
            encoding: 'utf8',
        })
            .trim()
            .split(' ')[0]
    // GitHub rebase merges can rewrite SHAs. Match each integrated patch to the
    // PR's ordered patches; squash merges intentionally compare one parent.
    let cursor = head
    for (const c of original.toReversed()) {
        if (cursor !== c.sha && patchId(cursor) !== patchId(c.sha)) return commit.parents[0].sha
        const node = JSON.parse(api(`commits/${cursor}`))
        if (node.parents.length !== 1) return commit.parents[0].sha
        cursor = node.parents[0].sha
    }
    return cursor
}
if (process.argv[1]?.endsWith('/integration.mjs'))
    console.log(integrationBase(process.env.GITHUB_REPOSITORY, process.argv[2]))
