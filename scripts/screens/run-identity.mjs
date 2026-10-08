/** A reusable publisher may only consume the caller's exact capture run attempt. */
export function verifyRunIdentity(run, repository, runId, attempt) {
    if (
        !Number.isSafeInteger(runId) ||
        runId < 1 ||
        !Number.isSafeInteger(attempt) ||
        attempt < 1 ||
        run.id !== runId ||
        run.head_repository?.full_name !== repository ||
        run.run_attempt !== attempt ||
        run.path !== '.github/workflows/screen-library.yml' ||
        !['pull_request', 'push', 'workflow_dispatch'].includes(run.event)
    )
        throw new Error('Run provenance mismatch')
    if (run.event !== 'pull_request' && run.head_branch !== 'dev')
        throw new Error('Only dev runs may publish integration or historical reports')
}
