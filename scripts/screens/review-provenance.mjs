/** Bind an Actions run to one live same-repository PR, even when GitHub omits its PR list. */
export function reviewProvenance(repository, run, candidates, git) {
    const origins = run.pull_requests ?? []
    if (origins.length > 1) throw new Error('Ambiguous PR provenance')
    const snapshot = origins[0]
    const head = snapshot?.head.sha ?? run.head_sha
    if (!/^[a-f0-9]{40}$/.test(head)) throw new Error('Invalid PR revision')
    if (snapshot && (snapshot.head.ref !== run.head_branch || snapshot.base.ref !== 'dev'))
        throw new Error('PR snapshot does not match triggering run')
    const matches = candidates.filter(
        (pr) =>
            pr.state === 'open' &&
            !pr.merged_at &&
            pr.base.ref === 'dev' &&
            pr.head.repo?.full_name === repository &&
            pr.head.ref === run.head_branch &&
            pr.head.sha === head &&
            (!origins.length || origins.some((origin) => origin.number === pr.number))
    )
    if (!matches.length) return null // closed, superseded, or no longer bound to this run
    if (matches.length !== 1) throw new Error('Ambiguous PR provenance')
    const pr = matches[0]
    // Preserve the event's base when available. If GitHub omitted it, require
    // today's exact merge base; a changed base fails publication and needs a rerun.
    const base = snapshot?.base.sha ?? pr.base.sha
    if (!/^[a-f0-9]{40}$/.test(base)) throw new Error('Invalid PR revision')
    return { pr, before: git(['merge-base', base, head]).trim(), after: head }
}

export function reviewHeadRevision(run) {
    const origins = run.pull_requests ?? []
    if (origins.length > 1) throw new Error('Ambiguous PR provenance')
    return origins[0]?.head.sha ?? run.head_sha
}
