import { readFileSync } from 'node:fs'

const validSha = (value) => /^[a-f0-9]{40}$/.test(value ?? '') && value !== '0'.repeat(40)

export function eligibleReviewBranches(_headRef, baseRef) {
    return baseRef === 'dev' || baseRef === 'main'
}

/** Bind an Actions run to one live same-repository PR, even when GitHub omits its PR list. */
export function reviewProvenance(repository, run, candidates, git) {
    const pr = reviewPullRequest(
        repository,
        run,
        candidates.filter((pr) => pr.state === 'open' && !pr.merged_at && !pr.draft)
    )
    if (!pr) return null // closed, superseded, or no longer bound to this run
    const snapshot = run.pull_requests?.[0]
    const head = reviewHeadRevision(run)
    // Main reviews compare the exact main tip captured by the event, even when the head diverges.
    // Feature reviews keep the merge base of the original event's base and head.
    const base = snapshot?.base.sha ?? pr.base.sha
    if (!validSha(base)) throw new Error('Invalid PR revision')
    if (pr.base.ref === 'main' && base !== pr.base.sha) return null
    return { pr, before: pr.base.ref === 'main' ? base : git(['merge-base', base, head]).trim(), after: head }
}

/** Resolve exact PR identity independently of whether the review is still live. */
export function reviewPullRequest(repository, run, candidates) {
    const origins = run.pull_requests ?? []
    if (origins.length > 1) throw new Error('Ambiguous PR provenance')
    const snapshot = origins[0]
    const head = snapshot?.head.sha ?? run.head_sha
    if (!validSha(head)) throw new Error('Invalid PR revision')
    if (
        snapshot &&
        (snapshot.head.ref !== run.head_branch || !eligibleReviewBranches(snapshot.head.ref, snapshot.base.ref))
    )
        throw new Error('PR snapshot does not match triggering run')
    const matches = candidates.filter(
        (pr) =>
            eligibleReviewBranches(pr.head.ref, pr.base.ref) &&
            (!snapshot || pr.base.ref === snapshot.base.ref) &&
            pr.head.repo?.full_name === repository &&
            pr.head.ref === run.head_branch &&
            pr.head.sha === head &&
            (!origins.length || origins.some((origin) => origin.number === pr.number))
    )
    if (!matches.length) return null
    if (matches.length !== 1) throw new Error('Ambiguous PR provenance')
    return matches[0]
}

export function reviewHeadRevision(run) {
    const origins = run.pull_requests ?? []
    if (origins.length > 1) throw new Error('Ambiguous PR provenance')
    return origins[0]?.head.sha ?? run.head_sha
}

// Actions can omit its PR snapshot. The original workflow_call event still
// establishes the PR number and immutable revision pair.
export function bindReleaseReviewEvent(repository, run, eventPath = process.env.GITHUB_EVENT_PATH) {
    if (run.event !== 'pull_request' || !eventPath) return run
    const { pull_request: eventPr } = JSON.parse(readFileSync(eventPath, 'utf8'))
    if (!eligibleReviewBranches(eventPr?.head?.ref, eventPr?.base?.ref)) return run
    const { number, head, base, draft } = eventPr
    const snapshots = run.pull_requests ?? []
    const snapshot = snapshots[0]
    if (
        !Number.isSafeInteger(number) ||
        number < 1 ||
        draft ||
        !eligibleReviewBranches(head?.ref, base.ref) ||
        head.repo?.full_name !== repository ||
        base.repo?.full_name !== repository ||
        run.head_branch !== head.ref ||
        !validSha(head.sha) ||
        !validSha(base.sha) ||
        snapshots.length > 1 ||
        (snapshot
            ? snapshot.number !== number ||
              snapshot.head?.ref !== head.ref ||
              snapshot.head?.sha !== head.sha ||
              snapshot.base?.ref !== base.ref ||
              snapshot.base?.sha !== base.sha
            : run.head_sha !== head.sha)
    )
        throw new Error('Release pull request event does not match the triggering run')
    return { ...run, pull_requests: [{ number, head, base }] }
}
