import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

// Acceptance tests derive from A1/A2 in the accepted publishing-failures plan.
// gh is a local fixture server: unexpected endpoints fail, and no network is used.
const repository = 'peanutprotocol/peanut-ui'
const head = 'a'.repeat(40)
const base = 'b'.repeat(40)
const runId = '12345'
const run = {
    id: Number(runId),
    event: 'pull_request',
    head_sha: head,
    head_branch: 'feature',
    head_repository: { full_name: repository },
    repository: { full_name: repository },
    path: '.github/workflows/screen-library.yml',
    status: 'completed',
    conclusion: 'success',
    pull_requests: [],
}
const pr = {
    number: 12,
    state: 'closed',
    merged_at: null,
    head: { sha: head, ref: 'feature', repo: { full_name: repository } },
    base: { sha: base, ref: 'dev', repo: { full_name: repository } },
}

function resolveReview(
    t,
    { event = run, candidates = [pr], apiFailure = false, paginated = false, argv = [], gitStatus = 0 } = {}
) {
    const directory = mkdtempSync(join(tmpdir(), 'screen-review-fixture-'))
    t.after(() => rmSync(directory, { recursive: true, force: true }))
    const fixture = join(directory, 'fixture.json')
    const calls = join(directory, 'calls.jsonl')
    writeFileSync(fixture, JSON.stringify({ event, candidates, apiFailure, paginated, repository, runId }))
    writeFileSync(
        join(directory, 'gh'),
        `#!${process.execPath}
const fs = require('node:fs')
const f = JSON.parse(fs.readFileSync(process.env.REVIEW_FIXTURE, 'utf8'))
const args = process.argv.slice(2)
fs.appendFileSync(process.env.REVIEW_CALLS, JSON.stringify(args) + '\\n')
const endpoint = args.find(a => a.startsWith('repos/'))?.split('?')[0]
if (f.apiFailure) { console.error('HTTP 403: Resource not accessible by integration'); process.exit(1) }
let response
if (endpoint === 'repos/' + f.repository + '/actions/runs/' + f.runId) response = f.event
else if (endpoint === 'repos/' + f.repository) response = { default_branch: 'main' }
else if (endpoint === 'repos/' + f.repository + '/commits/' + (f.event.pull_requests[0]?.head.sha || f.event.head_sha) + '/pulls') {
  response = args.includes('--slurp') ? (f.paginated ? [[], f.candidates] : [f.candidates]) : f.candidates
} else if (/\\/actions\\/runs\\/[^/]+\\/(artifacts|jobs)$/.test(endpoint || '')) {
  response = endpoint.endsWith('/artifacts') ? { artifacts: [] } : { jobs: [] }
} else if (/\\/actions\\/(workflows\\/[^/]+\\/)?runs$/.test(endpoint || '')) {
  response = { workflow_runs: [] }
} else { console.error('Unexpected fixture endpoint: ' + endpoint); process.exit(97) }
console.log(JSON.stringify(response))
`,
        { mode: 0o755 }
    )
    // The revision fixture never consults the developer's checkout or git config.
    // Successful merge-base resolves to the accepted exact before revision.
    writeFileSync(
        join(directory, 'git'),
        `#!${process.execPath}
const args = process.argv.slice(2)
if (${gitStatus}) process.exit(${gitStatus})
if (args[0] === 'merge-base') console.log('${base}')
else if (args[0] === 'rev-parse') {
  const revision = args.find(arg => /^[a-f0-9]{40}(?:\\^\\{commit\\})?$/.test(arg))
  if (!revision) process.exit(97)
  console.log(revision.slice(0, 40))
} else process.exit(97)
`,
        { mode: 0o755 }
    )
    // Mocked runs own their event input; an enclosing Actions event belongs to another run.
    const env = { ...process.env }
    delete env.GITHUB_EVENT_PATH
    const result = spawnSync(process.execPath, ['scripts/screens/resolve-baseline.mjs', ...argv], {
        encoding: 'utf8',
        timeout: 10_000,
        env: {
            ...env,
            PATH: `${directory}:${process.env.PATH}`,
            REPOSITORY: repository,
            RUN_ID: runId,
            REVIEW_FIXTURE: fixture,
            REVIEW_CALLS: calls,
        },
    })
    assert.ifError(result.error)
    assert.doesNotMatch(result.stderr, /Unexpected fixture endpoint/, 'fixture must support every requested API read')
    return { ...result, calls: readFileSync(calls, 'utf8').trim().split('\n').map(JSON.parse) }
}

for (const [name, candidate, paginated] of [
    ['closed PR', pr, false],
    ['merged PR', { ...pr, merged_at: '2026-11-01T00:00:00Z' }, false],
    ['closed PR on a later API page', pr, true],
]) {
    test(`${name} skips successfully before any baseline lookup`, (t) => {
        const result = resolveReview(t, { candidates: [candidate], paginated })
        assert.equal(result.status, 0, result.stderr)
        assert.match(result.stdout, /^mode=skip$/m)
        assert.match(result.stderr, /::notice::/)
        const endpoints = result.calls.map((args) => args.find((arg) => arg.startsWith('repos/'))?.split('?')[0])
        assert.ok(endpoints.includes(`repos/${repository}/commits/${head}/pulls`))
        assert.ok(
            endpoints.every((endpoint) =>
                [
                    `repos/${repository}`,
                    `repos/${repository}/actions/runs/${runId}`,
                    `repos/${repository}/commits/${head}/pulls`,
                ].includes(endpoint)
            ),
            `skip must not query jobs, artifacts, or baseline runs: ${JSON.stringify(endpoints)}`
        )
        const pullCall = result.calls.find((args) => args.some((arg) => arg.includes('/pulls')))
        assert.ok(pullCall.includes('--paginate'), 'candidate lookup must paginate')
        assert.ok(pullCall.includes('--slurp'), 'candidate lookup must preserve page boundaries')
    })
}

test('event PR number binds a closed review when a sibling PR shares its commit', (t) => {
    const event = { ...run, pull_requests: [{ number: 12, head: pr.head, base: pr.base }] }
    const result = resolveReview(t, { event, candidates: [pr, { ...pr, number: 13, state: 'open' }] })
    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /^mode=skip$/m)
})

for (const [name, candidates, event] of [
    ['missing PR', [], run],
    ['stale head', [{ ...pr, head: { ...pr.head, sha: 'c'.repeat(40) } }], run],
    ['wrong branch', [{ ...pr, head: { ...pr.head, ref: 'other-feature' } }], run],
    ['fork repository', [{ ...pr, head: { ...pr.head, repo: { full_name: 'fork/peanut-ui' } } }], run],
    ['wrong base branch', [{ ...pr, base: { ...pr.base, ref: 'main' } }], run],
    ['ambiguous closed candidates', [pr, { ...pr, number: 13 }], run],
    ['ambiguous open and closed candidates', [pr, { ...pr, number: 13, state: 'open' }], run],
    [
        'malformed exact review head',
        [{ ...pr, head: { ...pr.head, sha: 'invalid-head' } }],
        { ...run, head_sha: 'invalid-head' },
    ],
    [
        'ambiguous event snapshots',
        [pr, { ...pr, number: 13 }],
        {
            ...run,
            pull_requests: [
                { number: 12, head: pr.head, base: pr.base },
                { number: 13, head: pr.head, base: pr.base },
            ],
        },
    ],
    ['wrong event PR number', [pr], { ...run, pull_requests: [{ number: 13, head: pr.head, base: pr.base }] }],
    [
        'invalid event branch',
        [pr],
        { ...run, pull_requests: [{ number: 12, head: { ...pr.head, ref: 'other' }, base: pr.base }] },
    ],
    ['open PR without an available exact baseline', [{ ...pr, state: 'open' }], run],
]) {
    test(`${name} fails closed instead of reporting a skip`, (t) => {
        const result = resolveReview(t, { candidates, event })
        assert.notEqual(result.status, 0, result.stdout)
        assert.doesNotMatch(result.stdout, /^mode=skip$/m)
    })
}

test('API authorization failure remains a failure', (t) => {
    const result = resolveReview(t, { apiFailure: true })
    assert.notEqual(result.status, 0)
    assert.doesNotMatch(result.stdout, /^mode=skip$/m)
    assert.match(result.stderr, /403|accessible|integration/)
})

// A3: retained current before captures must use the same live PR gate, even
// though no external baseline lookup is necessary for this path.
for (const [name, candidate] of [
    ['closed', pr],
    ['merged', { ...pr, merged_at: '2026-11-01T00:00:00Z' }],
]) {
    test(`current captures still skip an exact ${name} PR`, (t) => {
        const result = resolveReview(t, { candidates: [candidate], argv: ['--current'] })
        assert.equal(result.status, 0, result.stderr)
        assert.match(result.stdout, /^mode=skip$/m)
        assert.match(result.stderr, /::notice::/)
        assert.doesNotMatch(JSON.stringify(result.calls), /\/artifacts|\/jobs|\/workflows\//)
    })
}

test('current captures fail closed when open review merge-base cannot resolve', (t) => {
    const result = resolveReview(t, { candidates: [{ ...pr, state: 'open' }], argv: ['--current'], gitStatus: 1 })
    assert.notEqual(result.status, 0, result.stdout)
    assert.doesNotMatch(result.stdout, /^mode=(?:skip|current)$/m)
})

test('current captures retain a valid exact open review without searching for an external baseline', (t) => {
    const result = resolveReview(t, { candidates: [{ ...pr, state: 'open' }], argv: ['--current'] })
    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /^mode=current$/m)
    assert.doesNotMatch(JSON.stringify(result.calls), /\/artifacts|\/jobs|\/workflows\//)
})

test('current captures preserve the non-PR push path', (t) => {
    const result = resolveReview(t, { event: { ...run, event: 'push', head_branch: 'dev' }, argv: ['--current'] })
    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /^mode=current$/m)
    assert.doesNotMatch(JSON.stringify(result.calls), /\/pulls|\/artifacts|\/jobs|\/workflows\//)
})
