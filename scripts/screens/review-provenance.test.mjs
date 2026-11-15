import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { bindReleaseReviewEvent, reviewHeadRevision, reviewProvenance } from './review-provenance.mjs'
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
    const event = {
        ...run,
        head_sha: 'd'.repeat(40),
        pull_requests: [{ number: 12, head: pr.head, base: { ...pr.base, sha: oldBase } }],
    }
    assert.equal(reviewProvenance(repository, event, [pr, { ...pr, number: 13 }], git).before, oldBase)
    assert.equal(reviewProvenance(repository, event, [pr], git).after, head)
    assert.equal(reviewHeadRevision(event), head)
})
test('closed or merged PR runs cannot overwrite the report link', () => {
    assert.equal(reviewProvenance(repository, run, [{ ...pr, state: 'closed' }], git), null)
    assert.equal(reviewProvenance(repository, run, [{ ...pr, merged_at: '2026-09-10' }], git), null)
})
test('mismatched event head is rejected', () => {
    const event = { ...run, pull_requests: [{ number: 12, head: { ...pr.head, sha: oldBase }, base: pr.base }] }
    assert.equal(reviewProvenance(repository, event, [pr], git), null)
})
test('snapshot branch and base must match the triggering review', () => {
    const wrongHead = { number: 12, head: { ...pr.head, ref: 'other' }, base: pr.base }
    assert.throws(() => reviewProvenance(repository, { ...run, pull_requests: [wrongHead] }, [pr], git), /snapshot/)
    const wrongBase = { number: 12, head: pr.head, base: { ...pr.base, ref: 'main' } }
    assert.equal(reviewProvenance(repository, { ...run, pull_requests: [wrongBase] }, [pr], git), null)
})

test('trusted caller event fills an empty Actions snapshot and preserves exact release identity', (t) => {
    const directory = mkdtempSync(join(tmpdir(), 'release-review-'))
    t.after(() => rmSync(directory, { recursive: true, force: true }))
    const eventPath = join(directory, 'event.json')
    const release = {
        ...pr,
        head: { ...pr.head, ref: 'dev' },
        base: { ...pr.base, ref: 'main', repo: { full_name: repository } },
    }
    writeFileSync(eventPath, JSON.stringify({ pull_request: release }))
    const releaseRun = { ...run, event: 'pull_request', head_branch: 'dev' }
    const bound = bindReleaseReviewEvent(repository, releaseRun, eventPath)
    const other = { ...release, number: release.number + 1 }
    assert.equal(reviewProvenance(repository, bound, [release, other], git).pr.number, release.number)
    assert.equal(
        reviewProvenance(repository, bound, [{ ...release, base: { ...release.base, sha: oldBase } }], git),
        null
    )
    assert.throws(
        () => bindReleaseReviewEvent(repository, { ...releaseRun, pull_requests: [other] }, eventPath),
        /does not match the triggering run/
    )
})

function callerEventFixture(t, target) {
    const directory = mkdtempSync(join(tmpdir(), 'caller-review-'))
    t.after(() => rmSync(directory, { recursive: true, force: true }))
    const eventPath = join(directory, 'event.json')
    const dev = {
        ...pr,
        draft: false,
        base: { ...pr.base, sha: oldBase, repo: { full_name: repository } },
    }
    const main = { ...dev, number: 13, base: { ...dev.base, ref: 'main' } }
    const original = target === 'dev' ? dev : main
    writeFileSync(eventPath, JSON.stringify({ pull_request: original }))
    const callerRun = { ...run, event: 'pull_request', head_sha: head }
    return { eventPath, callerRun, original, dev, main }
}

for (const target of ['dev', 'main']) {
    test(`original ${target} caller event binds the exact sibling PR regardless of candidate order`, (t) => {
        const { eventPath, callerRun, original, dev, main } = callerEventFixture(t, target)
        const bound = bindReleaseReviewEvent(repository, callerRun, eventPath)
        assert.equal(bound.pull_requests.length, 1)
        const snapshot = bound.pull_requests[0]
        assert.equal(snapshot.number, original.number)
        assert.equal(snapshot.head.sha, original.head.sha)
        assert.equal(snapshot.head.ref, original.head.ref)
        assert.equal(snapshot.base.sha, original.base.sha)
        assert.equal(snapshot.base.ref, target)
        for (const candidates of [
            [dev, main],
            [main, dev],
        ]) {
            const calls = []
            const result = reviewProvenance(repository, bound, candidates, (args) => {
                calls.push(args)
                return 'e'.repeat(40)
            })
            assert.equal(result.pr.number, original.number)
            assert.equal(result.after, head)
            assert.equal(result.before, target === 'dev' ? 'e'.repeat(40) : oldBase)
            assert.deepEqual(calls, target === 'dev' ? [['merge-base', oldBase, head]] : [])
        }
    })

    test(`original ${target} caller event rejects closed or superseded live PRs`, (t) => {
        const { eventPath, callerRun, original } = callerEventFixture(t, target)
        const bound = bindReleaseReviewEvent(repository, callerRun, eventPath)
        for (const live of [
            { ...original, state: 'closed' },
            { ...original, head: { ...original.head, sha: 'f'.repeat(40) } },
        ]) {
            assert.equal(reviewProvenance(repository, bound, [live], git), null)
        }
    })
}

test('dev caller snapshot retains its base for merge-base when the live dev branch moves', (t) => {
    const { eventPath, callerRun, original } = callerEventFixture(t, 'dev')
    const bound = bindReleaseReviewEvent(repository, callerRun, eventPath)
    const live = { ...original, base: { ...original.base, sha: base } }
    const calls = []
    const result = reviewProvenance(repository, bound, [live], (args) => {
        calls.push(args)
        return 'e'.repeat(40)
    })
    assert.deepEqual(calls, [['merge-base', oldBase, head]])
    assert.equal(result.before, 'e'.repeat(40))
    assert.equal(result.after, head)
})

test('dev caller events receive the same malformed and mismatched identity validation as main', (t) => {
    const { eventPath, callerRun, original } = callerEventFixture(t, 'dev')
    for (const invalid of [
        { ...original, number: 0 },
        { ...original, head: { ...original.head, sha: 'not-a-sha' } },
        { ...original, head: { ...original.head, ref: 'unrelated' } },
        { ...original, head: { ...original.head, repo: { full_name: 'fork/ui' } } },
        { ...original, base: { ...original.base, repo: { full_name: 'other/ui' } } },
    ]) {
        writeFileSync(eventPath, JSON.stringify({ pull_request: invalid }))
        assert.throws(() => bindReleaseReviewEvent(repository, callerRun, eventPath))
    }
    writeFileSync(eventPath, JSON.stringify({ pull_request: original }))
    assert.throws(
        () =>
            bindReleaseReviewEvent(
                repository,
                {
                    ...callerRun,
                    pull_requests: [{ ...original, number: original.number + 1 }],
                },
                eventPath
            ),
        /does not match the triggering run/
    )
})

for (const target of ['dev', 'main']) {
    test(`original ${target} event returns null when only the opposite-base sibling is live`, (t) => {
        const { eventPath, callerRun, dev, main } = callerEventFixture(t, target)
        const bound = bindReleaseReviewEvent(repository, callerRun, eventPath)
        assert.equal(reviewProvenance(repository, bound, [target === 'dev' ? main : dev], git), null)
    })
}

test('absent or unsupported caller PR events preserve the original run', (t) => {
    const { eventPath, callerRun, original } = callerEventFixture(t, 'dev')
    assert.deepEqual(bindReleaseReviewEvent(repository, callerRun, ''), callerRun)
    for (const event of [{}, { pull_request: { ...original, base: { ...original.base, ref: 'staging' } } }]) {
        writeFileSync(eventPath, JSON.stringify(event))
        assert.deepEqual(bindReleaseReviewEvent(repository, callerRun, eventPath), callerRun)
    }
})

test('dev caller event disambiguates simultaneous dev and main candidates', (t) => {
    const { eventPath, callerRun, dev, main } = callerEventFixture(t, 'dev')
    const bound = bindReleaseReviewEvent(repository, callerRun, eventPath)
    const result = reviewProvenance(repository, bound, [main, dev], git)
    assert.equal(result.pr.number, dev.number)
    assert.equal(result.before, oldBase)
    assert.equal(result.after, head)
})
