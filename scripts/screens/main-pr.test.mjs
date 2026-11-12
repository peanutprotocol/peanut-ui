import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as provenance from './review-provenance.mjs'
import * as current from './check-review-current.mjs'

// Acceptance tests authored from the behavior contract, without production-source access.
const repository = 'peanutprotocol/peanut-ui'
const baseSha = '1'.repeat(40)
const headSha = '2'.repeat(40)
const otherSha = '3'.repeat(40)
const mainHeads = [
    'dev',
    'hotfix/login',
    'cherry-pick/123',
    'feature/profile',
    'release/2026-11',
    'fix-payments',
    'maintenance',
]

function candidate(headRef = 'hotfix/login', baseRef = 'main') {
    return {
        number: 71,
        state: 'open',
        merged_at: null,
        draft: false,
        head: { ref: headRef, sha: headSha, repo: { full_name: repository } },
        base: { ref: baseRef, sha: baseSha, repo: { full_name: repository } },
    }
}

function runFor(pr = candidate()) {
    return {
        event: 'pull_request',
        head_sha: pr.head.sha,
        head_branch: pr.head.ref,
        pull_requests: [
            {
                number: pr.number,
                head: { ref: pr.head.ref, sha: pr.head.sha },
                base: { ref: pr.base.ref, sha: pr.base.sha },
            },
        ],
    }
}

function captureFor(pr = candidate()) {
    return { repository, head: pr.head.sha, base: pr.base.sha, headRef: pr.head.ref, baseRef: pr.base.ref }
}

function noMergeBase() {
    assert.fail('main review must use the immutable event base SHA without invoking git')
}

function assertRejected(callback) {
    let result
    try {
        result = callback()
    } catch (error) {
        if (error instanceof assert.AssertionError) throw error
        return
    }
    assert.equal(result, null)
}

function withEvent(event, callback) {
    const directory = mkdtempSync(join(tmpdir(), 'screen-main-pr-spec-'))
    try {
        const eventPath = join(directory, 'event.json')
        writeFileSync(eventPath, JSON.stringify(event))
        return callback(eventPath)
    } finally {
        rmSync(directory, { recursive: true, force: true })
    }
}

for (const headRef of mainHeads) {
    test(`arbitrary same-repo main PR branch is eligible: ${headRef}`, () => {
        const pr = candidate(headRef)
        assert.equal(provenance.eligibleReviewBranches(headRef, 'main'), true)
        const result = provenance.reviewProvenance(repository, runFor(pr), [pr], noMergeBase)
        assert.ok(result, 'main PR must retain review provenance')
        assert.equal(result.pr.number, pr.number)
        assert.equal(result.before, baseSha)
        assert.equal(result.after, headSha)
        assert.equal(current.currentCaptureReview(pr, captureFor(pr)), true)
    })
}

test('feature PRs to dev preserve git merge-base selection', () => {
    const pr = candidate('feature/profile', 'dev')
    const invocations = []
    const result = provenance.reviewProvenance(repository, runFor(pr), [pr], (args) => {
        invocations.push(args)
        return otherSha
    })
    assert.ok(result)
    assert.equal(result.before, otherSha)
    assert.equal(result.after, headSha)
    assert.deepEqual(invocations, [['merge-base', baseSha, headSha]])
})

test('unrelated target branches do not become review-eligible', () => {
    for (const target of ['staging', 'release/next', 'MAIN', '']) {
        assert.equal(provenance.eligibleReviewBranches('hotfix/login', target), false)
    }
})

const invalidCandidates = {
    draft: (pr) => {
        pr.draft = true
    },
    closed: (pr) => {
        pr.state = 'closed'
    },
    merged: (pr) => {
        pr.merged_at = '2026-11-10T12:00:00Z'
    },
    fork: (pr) => {
        pr.head.repo.full_name = 'outside/mobile'
    },
    'stale head SHA': (pr) => {
        pr.head.sha = otherSha
    },
    'stale base SHA': (pr) => {
        pr.base.sha = otherSha
    },
    'changed head branch': (pr) => {
        pr.head.ref = 'hotfix/other'
    },
    'retargeted base': (pr) => {
        pr.base.ref = 'dev'
    },
    'missing head repository': (pr) => {
        delete pr.head.repo
    },
}

for (const [name, mutate] of Object.entries(invalidCandidates)) {
    test(`stale or untrusted main PR cannot supply provenance or update review: ${name}`, () => {
        const original = candidate()
        const changed = structuredClone(original)
        mutate(changed)
        assertRejected(() => provenance.reviewProvenance(repository, runFor(original), [changed], noMergeBase))
        assert.equal(current.currentCaptureReview(changed, captureFor(original)), false)
    })
}

test('run PR number identifies the candidate even when another PR shares the commit', () => {
    const pr = candidate()
    const other = { ...structuredClone(pr), number: pr.number + 1 }
    assertRejected(() => provenance.reviewProvenance(repository, runFor(pr), [other], noMergeBase))
    assert.equal(provenance.reviewProvenance(repository, runFor(pr), [other, pr], noMergeBase)?.pr.number, pr.number)
})

test('populated event snapshot head SHA is authoritative over a synthetic run merge SHA', () => {
    const pr = candidate()
    const run = { ...runFor(pr), head_sha: otherSha }
    const result = provenance.reviewProvenance(repository, run, [pr], noMergeBase)
    assert.equal(result?.after, headSha)
    const bound = withEvent({ pull_request: pr }, (path) => provenance.bindReleaseReviewEvent(repository, run, path))
    assert.equal(bound.pull_requests[0].head.sha, headSha)
})

for (const [name, mutate] of Object.entries({
    'run branch': (run) => {
        run.head_branch = 'hotfix/other'
    },
    'event head ref': (run) => {
        run.pull_requests[0].head.ref = 'hotfix/other'
    },
    'event base ref': (run) => {
        run.pull_requests[0].base.ref = 'dev'
    },
    'event head SHA': (run) => {
        run.pull_requests[0].head.sha = otherSha
    },
    'event base SHA': (run) => {
        run.pull_requests[0].base.sha = otherSha
    },
})) {
    test(`main provenance fails closed for mismatched ${name}`, () => {
        const pr = candidate()
        const run = runFor(pr)
        mutate(run)
        assertRejected(() => provenance.reviewProvenance(repository, run, [pr], noMergeBase))
    })
}

test('event binding rejects missing immutable base SHA while direct provenance preserves fallback', () => {
    const pr = candidate()
    const run = runFor(pr)
    delete run.pull_requests[0].base.sha
    const result = provenance.reviewProvenance(repository, run, [pr], noMergeBase)
    assert.equal(result?.before, baseSha)
    assert.equal(result?.after, headSha)
    withEvent({ pull_request: pr }, (path) => {
        assert.throws(() => provenance.bindReleaseReviewEvent(repository, run, path))
    })
    const incompleteEventPr = structuredClone(pr)
    delete incompleteEventPr.base.sha
    withEvent({ pull_request: incompleteEventPr }, (path) => {
        assert.throws(() => provenance.bindReleaseReviewEvent(repository, runFor(pr), path))
    })
})

for (const sha of ['', 'a'.repeat(39), 'a'.repeat(41), 'A'.repeat(40), 'g'.repeat(40), 'main']) {
    test(`event binding rejects malformed immutable SHA ${JSON.stringify(sha)}`, () => {
        for (const side of ['head', 'base']) {
            const pr = candidate()
            pr[side].sha = sha
            withEvent({ pull_request: pr }, (path) => {
                assert.throws(() => provenance.bindReleaseReviewEvent(repository, runFor(pr), path))
            })
        }
    })
}

test('event binding recovers the immutable PR snapshot when run API omits PR snapshots', () => {
    const pr = candidate()
    const run = { ...runFor(pr), pull_requests: [] }
    const bound = withEvent({ pull_request: pr }, (path) => provenance.bindReleaseReviewEvent(repository, run, path))
    assert.equal(bound.pull_requests.length, 1)
    assert.equal(bound.pull_requests[0].number, pr.number)
    assert.equal(bound.pull_requests[0].head.ref, pr.head.ref)
    assert.equal(bound.pull_requests[0].head.sha, headSha)
    assert.equal(bound.pull_requests[0].base.ref, 'main')
    assert.equal(bound.pull_requests[0].base.sha, baseSha)
    assert.equal(provenance.reviewProvenance(repository, bound, [pr], noMergeBase)?.before, baseSha)
})

test('event binding accepts a matching main PR snapshot', () => {
    const pr = candidate()
    const bound = withEvent({ pull_request: pr }, (path) =>
        provenance.bindReleaseReviewEvent(repository, runFor(pr), path)
    )
    assert.equal(bound.pull_requests[0].number, pr.number)
    assert.equal(bound.pull_requests[0].base.sha, baseSha)
    assert.equal(bound.pull_requests[0].head.sha, headSha)
})

for (const [field, value] of [
    ['head_sha', otherSha],
    ['head_branch', 'hotfix/other'],
]) {
    test(`event binding without API snapshots rejects mismatched run ${field}`, () => {
        const pr = candidate()
        const run = { ...runFor(pr), pull_requests: [], [field]: value }
        withEvent({ pull_request: pr }, (path) => {
            assert.throws(() => provenance.bindReleaseReviewEvent(repository, run, path))
        })
    })
}

for (const [name, mutate] of Object.entries({
    'PR number': (pr) => {
        pr.number += 1
    },
    'head SHA': (pr) => {
        pr.head.sha = otherSha
    },
    'base SHA': (pr) => {
        pr.base.sha = otherSha
    },
    'head branch': (pr) => {
        pr.head.ref = 'hotfix/other'
    },
    'head repository': (pr) => {
        pr.head.repo.full_name = 'outside/mobile'
    },
    'base repository': (pr) => {
        pr.base.repo.full_name = 'outside/mobile'
    },
    'malformed SHA': (pr) => {
        pr.head.sha = 'A'.repeat(40)
    },
})) {
    test(`event binding rejects a mismatched ${name}`, () => {
        const original = candidate()
        const changed = structuredClone(original)
        mutate(changed)
        withEvent({ pull_request: changed }, (path) => {
            assert.throws(() => provenance.bindReleaseReviewEvent(repository, runFor(original), path))
        })
    })
}

test('event binding preserves absent and non-main PR payload paths', () => {
    const run = runFor()
    for (const event of [{}, { pull_request: candidate('feature/profile', 'dev') }]) {
        withEvent(event, (path) => assert.deepEqual(provenance.bindReleaseReviewEvent(repository, run, path), run))
    }
})

test('direct provenance preserves unique-candidate fallback when API omits snapshots', () => {
    const pr = candidate()
    const run = { ...runFor(pr), pull_requests: [] }
    const result = provenance.reviewProvenance(repository, run, [pr], noMergeBase)
    assert.equal(result?.before, baseSha)
    assert.equal(result?.after, headSha)
})

function workflowJobCondition(filename, job) {
    const source = readFileSync(new URL(`../../.github/workflows/${filename}`, import.meta.url), 'utf8')
    const lines = source.split(/\r?\n/)
    const start = lines.findIndex((line) => line.trim() === `${job}:`)
    assert.ok(start >= 0, `missing ${job} job in ${filename}`)
    const jobIndent = lines[start].match(/^\s*/)[0].length
    let end = lines.findIndex(
        (line, index) => index > start && line.trim() && line.match(/^\s*/)[0].length <= jobIndent
    )
    if (end < 0) end = lines.length
    const block = lines.slice(start + 1, end)
    const ifIndex = block.findIndex((line) => /^\s+if:/.test(line))
    assert.ok(ifIndex >= 0, `missing job condition for ${job}`)
    const ifIndent = block[ifIndex].match(/^\s*/)[0].length
    let expression = block[ifIndex].replace(/^\s+if:\s*/, '')
    if (/^[>|][-+]?$/.test(expression)) expression = ''
    for (
        let index = ifIndex + 1;
        index < block.length && (block[index].match(/^\s*/)[0].length > ifIndent || /^\s*$/.test(block[index]));
        index++
    ) {
        expression += ` ${block[index].trim()}`
    }
    return expression
        .trim()
        .replace(/^\$\{\{\s*/, '')
        .replace(/\s*\}\}$/, '')
}

function conditionAllows(filename, job, github) {
    const condition = workflowJobCondition(filename, job)
    return Boolean(
        Function(
            'github',
            'needs',
            'always',
            'cancelled',
            `return (${condition});`
        )(
            github,
            { route: { result: 'skipped' } },
            () => true,
            () => false
        )
    )
}

function githubEvent({
    target = 'main',
    branch = 'hotfix/login',
    action = 'opened',
    draft = false,
    fork = false,
    retargeted = false,
    event = 'pull_request',
} = {}) {
    const pr = candidate(branch, target)
    pr.draft = draft
    if (fork) pr.head.repo.full_name = 'outside/mobile'
    return {
        event_name: event,
        repository,
        ref: 'refs/heads/dev',
        base_ref: target,
        head_ref: branch,
        event: {
            action,
            pull_request: pr,
            changes: { base: { ref: retargeted ? { from: 'dev' } : null } },
            inputs: {},
        },
    }
}

const workflowJobs = [
    ['screen-library.yml', 'backdoor-scan'],
    ['screen-library.yml', 'refs'],
    ['screen-library-publish.yml', 'publish'],
]

for (const [filename, job] of workflowJobs) {
    test(`${filename} ${job}: main PR eligibility covers arbitrary branches`, () => {
        for (const branch of mainHeads) {
            for (const action of ['opened', 'synchronize', 'reopened', 'ready_for_review']) {
                assert.equal(
                    conditionAllows(filename, job, githubEvent({ branch, action })),
                    true,
                    `${branch}: ${action}`
                )
            }
        }
    })
    test(`${filename} ${job}: main PR forks and drafts are excluded`, () => {
        for (const overrides of [{ fork: true }, { draft: true }, { draft: true, action: 'converted_to_draft' }]) {
            assert.equal(conditionAllows(filename, job, githubEvent(overrides)), false, JSON.stringify(overrides))
        }
    })
}

test('backdoor scan preserves base-dev fork and draft eligibility', () => {
    for (const overrides of [{ fork: true }, { draft: true }, { fork: true, draft: true }]) {
        assert.equal(
            conditionAllows('screen-library.yml', 'backdoor-scan', githubEvent({ target: 'dev', ...overrides })),
            true
        )
        assert.equal(conditionAllows('screen-library.yml', 'refs', githubEvent({ target: 'dev', ...overrides })), false)
    }
})

test('backdoor scan skips unrelated edited events and accepts base retargeting', () => {
    for (const target of ['main', 'dev']) {
        assert.equal(
            conditionAllows('screen-library.yml', 'backdoor-scan', githubEvent({ target, action: 'edited' })),
            false
        )
        assert.equal(
            conditionAllows(
                'screen-library.yml',
                'backdoor-scan',
                githubEvent({ target, action: 'edited', retargeted: true })
            ),
            true
        )
    }
})

test('capture refs preserve push and manual entrypoints', () => {
    for (const event of ['push', 'workflow_dispatch']) {
        assert.equal(conditionAllows('screen-library.yml', 'refs', githubEvent({ event })), true)
    }
})
