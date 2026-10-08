import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const immutableSha = (value) => /^[a-f0-9]{40}$/.test(value ?? '') && value !== '0'.repeat(40)

/** Compare every commit in a branch update, including multi-commit and force pushes. */
export function pushRevisions({ head, before }) {
    if (!immutableSha(head)) throw new Error('Invalid push head revision')
    if (!immutableSha(before)) throw new Error('Missing previous branch revision from push event')
    return { before, after: head }
}

/** Manual backfills may select only already released main history. */
export function mainRevisions(
    { event, head, before, after },
    git = (args) => execFileSync('git', args, { encoding: 'utf8' })
) {
    if (!immutableSha(head)) throw new Error('Invalid main run head')
    if (event === 'push') return pushRevisions({ head, before })
    if (event !== 'workflow_dispatch') throw new Error('Unsupported main capture event')
    after = after || head
    if (!immutableSha(after) || (before && !immutableSha(before))) throw new Error('Expected immutable main SHAs')
    // Manual backfills may select a released revision, never an unmerged dev/PR revision.
    git(['merge-base', '--is-ancestor', after, head])
    before = before || git(['rev-parse', `${after}^1`]).trim()
    if (!immutableSha(before)) throw new Error('Invalid previous main revision')
    git(['merge-base', '--is-ancestor', before, after])
    return { before, after }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const input = {
        event: process.env.EVENT,
        head: process.env.PUSH_HEAD,
        before: process.env.EVENT === 'push' ? process.env.PUSH_BEFORE : process.env.MAIN_BEFORE,
        after: process.env.MAIN_AFTER,
    }
    const refs = input.event === 'push' ? pushRevisions(input) : mainRevisions(input)
    console.log(`before=${refs.before}\nafter=${refs.after}`)
}
