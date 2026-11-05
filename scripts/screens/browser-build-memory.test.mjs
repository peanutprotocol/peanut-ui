import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

const require = createRequire(import.meta.url)
// Use the installed dependency graph without introducing a new package.
const { load: parse } = createRequire(require.resolve('eslint'))('js-yaml')
const workflow = parse(readFileSync(new URL('../../.github/workflows/tests.yml', import.meta.url), 'utf8'))
const contracts = [
    { id: 'press-contract', deadline: 25, environment: 'preview', baseUrl: 'http://127.0.0.1:3081' },
    { id: 'seo-contract', deadline: 30, environment: 'production', baseUrl: 'https://peanut.me' },
]

function buildStep(job) {
    const steps = job.steps.filter((step) => step.run?.trim() === 'pnpm build')
    assert.equal(steps.length, 1, 'one unwrapped production build must propagate its exit status')
    return steps[0]
}

function assertFailurePropagation(step) {
    assert.ok(step['continue-on-error'] === undefined || step['continue-on-error'] === false)
    assert.doesNotMatch(step.run, /\|\|\s*(?:true|:|echo)\b|\bset\s+\+e\b|\bexit\s+0\b/)
}

test('heap override is scoped to individual build steps', () => {
    assert.equal(workflow.env?.NODE_OPTIONS, undefined)
    for (const job of Object.values(workflow.jobs)) {
        assert.equal(job.env?.NODE_OPTIONS, undefined)
    }
})

for (const contract of contracts) {
    test(`${contract.id} retains its environment, deadline and bounded build heap`, () => {
        const job = workflow.jobs[contract.id]
        assert.ok(job)
        assert.equal(job['timeout-minutes'], contract.deadline)
        assert.ok(job['continue-on-error'] === undefined || job['continue-on-error'] === false)
        const step = buildStep(job)
        assert.equal(step.env?.NODE_OPTIONS, '--max-old-space-size=4096')
        assertFailurePropagation(step)
        const effectiveEnv = { ...workflow.env, ...job.env, ...step.env }
        assert.equal(effectiveEnv.NEXT_PUBLIC_VERCEL_ENV, contract.environment)
        assert.equal(effectiveEnv.NEXT_PUBLIC_BASE_URL, contract.baseUrl)
        assert.ok(effectiveEnv.NEXT_FONT_GOOGLE_MOCKED_RESPONSES, 'build must retain mocked font responses')
    })

    test(`${contract.id} heap setting reaches a Node grandchild without allocating a large heap`, () => {
        const step = buildStep(workflow.jobs[contract.id])
        assert.equal(step.env?.NODE_OPTIONS, '--max-old-space-size=4096')
        const probe = `
            const { spawnSync } = require('node:child_process');
            const code = "console.log(JSON.stringify({options:process.env.NODE_OPTIONS,heap:require('node:v8').getHeapStatistics().heap_size_limit}))";
            const child = spawnSync(process.execPath, ['-e', code], {encoding:'utf8',timeout:5000});
            process.stdout.write(child.stdout || '');
            process.stderr.write(child.stderr || '');
            process.exit(child.status === null ? 1 : child.status);
        `
        const result = spawnSync(process.execPath, ['-e', probe], {
            env: { ...process.env, NODE_OPTIONS: step.env.NODE_OPTIONS },
            encoding: 'utf8',
            timeout: 10000,
            maxBuffer: 65536,
        })
        assert.equal(result.error, undefined)
        assert.equal(result.status, 0, result.stderr)
        const observed = JSON.parse(result.stdout)
        assert.equal(observed.options, '--max-old-space-size=4096')
        // V8 adds young-generation space to the configured old-space budget.
        assert.ok(observed.heap >= 4096 * 1024 ** 2 && observed.heap < 4352 * 1024 ** 2)
    })
}

test('press physics, drawer shadow clipping and rendered SEO remain blocking checks', () => {
    for (const [id, command] of [
        ['press-contract', /(?:pnpm|node|npx)[^\n]*press[^\n]*physics/],
        ['press-contract', /(?:pnpm|node|npx)[^\n]*drawer[^\n]*shadow[-:]clip/],
        ['seo-contract', /pnpm test:seo:rendered\b/],
    ]) {
        const checks = workflow.jobs[id].steps.filter((step) => command.test(step.run ?? ''))
        assert.ok(checks.length > 0, `${id} must retain ${command}`)
        for (const step of checks) assertFailurePropagation(step)
    }
})
