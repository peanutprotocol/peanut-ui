import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { bindReleaseReviewEvent } from './review-provenance.mjs'

const repository = 'synthetic/fixture'
const head = '1'.repeat(40)
const base = '2'.repeat(40)
const event = () => ({
    pull_request: {
        number: 9321,
        draft: false,
        head: { ref: 'dev', sha: head, repo: { full_name: repository } },
        base: { ref: 'main', sha: base, repo: { full_name: repository } },
    },
})
const run = () => ({ event: 'pull_request', head_sha: head, head_branch: 'dev', pull_requests: [] })

for (const ambient of ['unrelated', 'malformed', 'missing']) {
    test(`offline publishing fixtures ignore ${ambient} outer event`, { timeout: 120000 }, async () => {
        const dir = await mkdtemp(join(tmpdir(), 'release-fixture-ambient-'))
        try {
            const eventPath = join(dir, 'event.json')
            if (ambient === 'unrelated') await writeFile(eventPath, JSON.stringify(event()))
            if (ambient === 'malformed') await writeFile(eventPath, '{not json')
            const env = { ...process.env, GITHUB_EVENT_PATH: eventPath }
            delete env.NODE_TEST_CONTEXT
            const child = spawnSync(
                process.execPath,
                [
                    '--test',
                    '--test-reporter=tap',
                    '--test-name-pattern=^(closed PR skips successfully before any baseline lookup|current captures retain a valid exact open review without searching for an external baseline)$',
                    'scripts/screens/publish-failures.test.mjs',
                ],
                {
                    cwd: process.cwd(),
                    env,
                    encoding: 'utf8',
                    timeout: 110000,
                    maxBuffer: 4 * 1024 * 1024,
                }
            )
            assert.ifError(child.error)
            assert.equal(child.signal, null, `child terminated: ${child.signal}`)
            assert.match(child.stdout, /# tests [1-9][0-9]*/, 'nested suite must execute tests')
            assert.equal(
                child.status,
                0,
                `offline suite failed under ${ambient} event:\n${child.stdout}\n${child.stderr}`
            )
            assert.match(child.stdout, /^ok \d+ - closed PR skips successfully before any baseline lookup\r?$/m)
            assert.match(
                child.stdout,
                /^ok \d+ - current captures retain a valid exact open review without searching for an external baseline\r?$/m
            )
            assert.match(child.stdout, /^# pass 2\r?$/m)
            assert.match(child.stdout, /^# fail 0\r?$/m)
        } finally {
            await rm(dir, { recursive: true, force: true })
        }
    })
}

test('release event binding accepts matching evidence and rejects mismatches', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'release-event-binding-'))
    try {
        const eventPath = join(dir, 'event.json')
        await writeFile(eventPath, JSON.stringify(event()))
        const bound = await bindReleaseReviewEvent(repository, run(), eventPath)
        assert.equal(bound.head_sha, head)
        assert.ok(bound.pull_requests.some((pr) => pr.number === 9321 && pr.head.sha === head && pr.base.sha === base))
        const mismatchedHead = { ...run(), head_sha: '3'.repeat(40) }
        const mismatchedSnapshot = {
            ...run(),
            pull_requests: [{ number: 9321, head: { sha: head }, base: { sha: '3'.repeat(40) } }],
        }
        for (const invalid of [mismatchedHead, mismatchedSnapshot]) {
            await assert.rejects(async () => bindReleaseReviewEvent(repository, invalid, eventPath))
        }
        const foreign = event()
        foreign.pull_request.head.repo.full_name = 'foreign/fixture'
        await writeFile(eventPath, JSON.stringify(foreign))
        await assert.rejects(async () => bindReleaseReviewEvent(repository, run(), eventPath))
        await writeFile(eventPath, '{bad')
        await assert.rejects(async () => bindReleaseReviewEvent(repository, run(), eventPath))
    } finally {
        await rm(dir, { recursive: true, force: true })
    }
})
