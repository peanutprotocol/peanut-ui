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
    // Merged dev parents are ancestors too, but were never main branch tips.
    // Bind both selections to the run head's first-parent release line.
    const releases = git(['rev-list', '--first-parent', head]).trim().split('\n')
    const afterIndex = releases.indexOf(after)
    if (afterIndex < 0) throw new Error('After revision is not on the first-parent main history')
    before = before || releases[afterIndex + 1]
    if (!immutableSha(before)) throw new Error('Invalid previous main revision')
    if (releases.indexOf(before) <= afterIndex)
        throw new Error('Before revision must be earlier on the first-parent main history')
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
