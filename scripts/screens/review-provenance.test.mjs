import test from 'node:test'
import assert from 'node:assert/strict'
import { reviewProvenance } from './review-provenance.mjs'
const repository = 'peanutprotocol/peanut-ui'
const head = 'a'.repeat(40),
    base = 'b'.repeat(40),
    oldBase = 'c'.repeat(40)
const run = { head_sha: head, head_branch: 'feature', pull_requests: [] }
const pr = {
    number: 12,
    state: 'open',
    merged_at: null,
    head: { sha: head, ref: 'feature', repo: { full_name: repository } },
    base: { sha: base, ref: 'dev' },
}
const git = (args) => args[1]
test('missing event PR list resolves only a unique same-repo branch and head', () => {
    assert.equal(reviewProvenance(repository, run, [pr], git).before, base)
    assert.equal(reviewProvenance(repository, run, [{ ...pr, head: { ...pr.head, sha: oldBase } }], git), null)
    assert.equal(
        reviewProvenance(repository, run, [{ ...pr, head: { ...pr.head, repo: { full_name: 'fork/ui' } } }], git),
        null
    )
})
test('ambiguous sibling PRs fail closed without an event binding', () => {
    assert.throws(() => reviewProvenance(repository, run, [pr, { ...pr, number: 13 }], git), /Ambiguous/)
})
test('event snapshot preserves the original base across concurrent dev changes', () => {
    const event = { ...run, pull_requests: [{ number: 12, head: pr.head, base: { ...pr.base, sha: oldBase } }] }
    assert.equal(reviewProvenance(repository, event, [pr, { ...pr, number: 13 }], git).before, oldBase)
})
test('closed or merged PR runs cannot overwrite the report link', () => {
    assert.equal(reviewProvenance(repository, run, [{ ...pr, state: 'closed' }], git), null)
    assert.equal(reviewProvenance(repository, run, [{ ...pr, merged_at: '2026-09-10' }], git), null)
})
test('mismatched event head is rejected', () => {
    const event = { ...run, pull_requests: [{ number: 12, head: { ...pr.head, sha: oldBase }, base: pr.base }] }
    assert.throws(() => reviewProvenance(repository, event, [pr], git), /snapshot/)
})
