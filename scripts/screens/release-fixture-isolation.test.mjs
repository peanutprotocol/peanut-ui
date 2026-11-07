import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, chmodSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, delimiter } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const repo = fileURLToPath(new URL('../..', import.meta.url))
const node = process.execPath
const repository = 'peanutprotocol/peanut-ui'
const head = 'a'.repeat(40),
    base = 'b'.repeat(40)
const pr = () => ({
    number: 12,
    state: 'open',
    merged_at: null,
    draft: false,
    head: { sha: head, ref: 'dev', repo: { full_name: repository } },
    base: { sha: base, ref: 'main', repo: { full_name: repository } },
})
const run = () => ({
    id: 12345,
    event: 'pull_request',
    head_sha: head,
    head_branch: 'dev',
    head_repository: { full_name: repository },
    repository: { full_name: repository },
    path: '.github/workflows/screen-library.yml',
    status: 'completed',
    conclusion: 'success',
    pull_requests: [],
})
function execute(args, env) {
    return spawnSync(node, args, { cwd: repo, env, encoding: 'utf8', timeout: 60000, maxBuffer: 2 * 1024 * 1024 })
}
function isolated(fn) {
    const dir = mkdtempSync(join(tmpdir(), 'release-fixture-'))
    try {
        return fn(dir)
    } finally {
        rmSync(dir, { recursive: true, force: true })
    }
}
function envFor(dir) {
    const env = { ...process.env, GH_CONFIG_DIR: dir, REPOSITORY: repository, RUN_ID: '12345' }
    delete env.NODE_TEST_CONTEXT
    return env
}
for (const scenario of ['absent', 'unrelated', 'unreadable']) {
    test(`fixture suite is independent of parent event: ${scenario}`, () =>
        isolated((dir) => {
            const env = envFor(dir)
            delete env.GITHUB_EVENT_PATH
            if (scenario === 'unrelated') {
                const path = join(dir, 'event.json')
                writeFileSync(path, JSON.stringify({ pull_request: pr() }))
                env.GITHUB_EVENT_PATH = path
            }
            if (scenario === 'unreadable') env.GITHUB_EVENT_PATH = join(dir, 'missing-event.json')
            const result = execute(['--test', 'scripts/screens/publish-failures.test.mjs'], env)
            assert.equal(result.error, undefined, String(result.error))
            assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
            const count = Number(result.stdout.match(/# tests (\d+)/)?.[1] ?? 0)
            assert.ok(count >= 22, `expected at least 22 executed tests, got ${count}\n${result.stdout}`)
        }))
}
function invoke(dir, runData, eventPr = pr()) {
    const eventPath = join(dir, 'event.json'),
        dataPath = join(dir, 'data.json'),
        logPath = join(dir, 'calls')
    writeFileSync(eventPath, JSON.stringify({ pull_request: eventPr }))
    writeFileSync(dataPath, JSON.stringify({ run: runData, pr: eventPr }))
    const stub = `#!${node}\nconst fs=require('node:fs'); const args=process.argv.slice(2); fs.appendFileSync(process.env.STUB_LOG, JSON.stringify(args)+'\\n'); const d=JSON.parse(fs.readFileSync(process.env.STUB_DATA)); const endpoint=args.find(x=>x.startsWith('repos/')); if(args[0]==='api' && endpoint==='repos/${repository}/actions/runs/12345') console.log(JSON.stringify(d.run)); else if(args[0]==='api' && endpoint==='repos/${repository}/pulls/12') console.log(JSON.stringify(d.pr)); else {console.error('unexpected gh endpoint '+JSON.stringify(args)); process.exit(9)}\n`
    writeFileSync(join(dir, 'gh'), stub)
    chmodSync(join(dir, 'gh'), 0o755)
    writeFileSync(join(dir, 'git'), `#!${node}\nconsole.error('unexpected git invocation'); process.exit(9);\n`)
    chmodSync(join(dir, 'git'), 0o755)
    const env = {
        ...envFor(dir),
        GITHUB_EVENT_PATH: eventPath,
        PATH: dir + delimiter + process.env.PATH,
        STUB_LOG: logPath,
        STUB_DATA: dataPath,
    }
    const result = execute(['scripts/screens/resolve-baseline.mjs', '--current'], env)
    const calls = (() => {
        try {
            return readFileSync(logPath, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse)
        } catch {
            return []
        }
    })()
    return { result, calls }
}
test('valid release resolves current using exact event PR', () =>
    isolated((dir) => {
        const { result, calls } = invoke(dir, run())
        assert.equal(result.error, undefined, String(result.error))
        assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
        assert.match(result.stdout, /mode=current/)
        assert.ok(calls.some((x) => x.includes(`repos/${repository}/actions/runs/12345`)))
        assert.ok(calls.some((x) => x.includes(`repos/${repository}/pulls/12`)))
        assert.ok(
            calls.every((x) =>
                x.some((y) => [`repos/${repository}/actions/runs/12345`, `repos/${repository}/pulls/12`].includes(y))
            ),
            JSON.stringify(calls)
        )
    }))
for (const [name, mutate] of [
    ['head sha', (r) => (r.head_sha = 'c'.repeat(40))],
    ['head branch', (r) => (r.head_branch = 'feature')],
    ['head repository', (r) => (r.head_repository.full_name = 'fork/peanut-ui')],
])
    test(`rejects mismatched ${name}`, () =>
        isolated((dir) => {
            const r = run()
            mutate(r)
            const { result, calls } = invoke(dir, r)
            assert.equal(result.error, undefined, String(result.error))
            assert.notEqual(result.status, 0, `${result.stdout}\n${result.stderr}`)
            assert.doesNotMatch(result.stderr, /unexpected (?:gh endpoint|git invocation)/)
            assert.doesNotMatch(result.stdout, /mode=(?:current|skip)/)
            assert.ok(
                calls.every((x) =>
                    x.some((y) =>
                        [`repos/${repository}/actions/runs/12345`, `repos/${repository}/pulls/12`].includes(y)
                    )
                ),
                JSON.stringify(calls)
            )
        }))
