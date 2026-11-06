import test from 'node:test'
import assert from 'node:assert/strict'
import { reviewProvenance } from './review-provenance.mjs'
import { currentCaptureReview } from './check-review-current.mjs'

const SHA = (n) => n.toString(16).padStart(40, '0')
const repository = 'acme/peanut'
const head = SHA(1)
const base = SHA(2)
const mergeBase = SHA(3)
const git =
    (result = mergeBase) =>
    (args) => {
        assert.deepEqual(args, ['merge-base', base, head])
        return result
    }
const candidate = (overrides = {}) => ({
    number: 42,
    state: 'open',
    merged_at: null,
    draft: false,
    head: { sha: head, ref: 'dev', repo: { full_name: repository } },
    base: { ref: 'main', sha: base },
    ...overrides,
})
const run = (overrides = {}) => ({
    head_sha: head,
    head_branch: 'dev',
    pull_requests: [{ number: 42, head: { ref: 'dev', sha: head }, base: { ref: 'main', sha: base } }],
    ...overrides,
})
const releaseContext = { repository, head, base, headRef: 'dev', baseRef: 'main' }

test('accepts an exact open same-repository dev-to-main release preview', () => {
    const result = reviewProvenance(repository, run(), [candidate()], git())
    assert.equal(result.pr.number, 42)
    assert.equal(result.before, base)
    assert.equal(result.after, head)
    assert.equal(currentCaptureReview(candidate(), releaseContext), true)
})

test('release review uses the exact main base SHA, even when git merge-base differs', () => {
    const pr = candidate()
    assert.notEqual(mergeBase, base)
    assert.equal(currentCaptureReview(pr, releaseContext), true)
    assert.equal(reviewProvenance(repository, run(), [pr], git()).before, base)
})

test('preserves feature-to-dev merge-base provenance', () => {
    const featureHead = SHA(4)
    const devBase = SHA(5)
    const featurePr = {
        number: 7,
        state: 'open',
        merged_at: null,
        draft: false,
        head: { sha: featureHead, ref: 'feature/x', repo: { full_name: repository } },
        base: { ref: 'dev', sha: devBase },
    }
    const featureRun = {
        head_sha: featureHead,
        head_branch: 'feature/x',
        pull_requests: [
            { number: 7, head: { sha: featureHead, ref: 'feature/x' }, base: { ref: 'dev', sha: devBase } },
        ],
    }
    const featureGit = (args) => {
        assert.deepEqual(args, ['merge-base', devBase, featureHead])
        return mergeBase
    }
    const result = reviewProvenance(repository, featureRun, [featurePr], featureGit)
    assert.equal(result.pr.number, 7)
    assert.equal(result.before, mergeBase)
    assert.equal(result.after, featureHead)
})

test('rejects fork candidates as release reviews', () => {
    const pr = candidate({ head: { sha: head, ref: 'dev', repo: { full_name: 'contributor/peanut' } } })
    assert.notEqual(currentCaptureReview(pr, releaseContext), true)
    assert.equal(reviewProvenance(repository, run(), [pr], git()), null)
})

test('rejects feature-to-main candidates as release reviews', () => {
    const pr = candidate({ head: { sha: head, ref: 'feature/x', repo: { full_name: repository } } })
    assert.notEqual(currentCaptureReview(pr, releaseContext), true)
    assert.equal(reviewProvenance(repository, run(), [pr], git()), null)
})

test('rejects retargeted candidates and stale head or release base snapshots', () => {
    const retargeted = candidate({ base: { ref: 'dev', sha: base } })
    const staleHead = candidate({ head: { sha: SHA(6), ref: 'dev', repo: { full_name: repository } } })
    const staleBase = candidate({ base: { ref: 'main', sha: SHA(7) } })
    for (const pr of [retargeted, staleHead, staleBase]) {
        assert.notEqual(currentCaptureReview(pr, releaseContext), true)
        assert.equal(reviewProvenance(repository, run(), [pr], git()), null)
    }
})

test('does not infer a release review from run snapshot alone when candidate is stale or absent', () => {
    assert.equal(reviewProvenance(repository, run(), [], git()), null)
    assert.equal(
        reviewProvenance(
            repository,
            run(),
            [candidate({ head: { sha: SHA(8), ref: 'dev', repo: { full_name: repository } } })],
            git()
        ),
        null
    )
})

test('allows unique supported matching candidate when run PR snapshot is empty', () => {
    const result = reviewProvenance(repository, run({ pull_requests: [] }), [candidate()], git())
    assert.equal(result.pr.number, 42)
    assert.equal(result.before, base)
    assert.equal(result.after, head)
})

test('rejects ambiguous matching candidates when run PR snapshot is empty', () => {
    const second = candidate({ number: 43 })
    let outcome
    try {
        outcome = reviewProvenance(repository, run({ pull_requests: [] }), [candidate(), second], git())
    } catch {
        outcome = 'failed-closed'
    }
    assert.ok(outcome === null || outcome === 'failed-closed')
})

test('closed, merged, and draft releases cannot be current publishable reviews', () => {
    const variants = [
        candidate({ state: 'closed' }),
        candidate({ state: 'closed', merged_at: '2026-11-06T12:00:00Z' }),
        candidate({ draft: true }),
    ]
    for (const pr of variants) {
        assert.notEqual(currentCaptureReview(pr, releaseContext), true)
        assert.equal(reviewProvenance(repository, run(), [pr], git()), null)
    }
})
