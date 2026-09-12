import test from 'node:test'
import assert from 'node:assert/strict'
import { verifyRunIdentity } from './run-identity.mjs'
const repository = 'peanutprotocol/peanut-ui'
const run = {
    id: 123,
    run_attempt: 2,
    head_repository: { full_name: repository },
    path: '.github/workflows/screen-library.yml',
    event: 'push',
    head_branch: 'dev',
    status: 'in_progress',
}
test('same-run publishing does not require a completed workflow_run event', () => {
    assert.doesNotThrow(() => verifyRunIdentity(run, repository, 123, 2))
    assert.doesNotThrow(() =>
        verifyRunIdentity({ ...run, event: 'pull_request', head_branch: 'feature' }, repository, 123, 2)
    )
})
test('reject unrelated workflow artifacts and stale attempts', () => {
    for (const changed of [
        { id: 124 },
        { run_attempt: 1 },
        { path: '.github/workflows/other.yml' },
        { head_repository: { full_name: 'fork/ui' } },
        { event: 'workflow_run' },
    ])
        assert.throws(() => verifyRunIdentity({ ...run, ...changed }, repository, 123, 2), /provenance/)
})
test('post-merge and historical publishing only accepts dev', () => {
    for (const event of ['push', 'workflow_dispatch'])
        assert.throws(() => verifyRunIdentity({ ...run, event, head_branch: 'main' }, repository, 123, 2), /Only dev/)
})
