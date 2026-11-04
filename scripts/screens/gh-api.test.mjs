import test from 'node:test'
import assert from 'node:assert/strict'
import { ghApiSync, isTransientGhError } from './gh-api.mjs'

const httpError = (status) =>
    Object.assign(new Error('Command failed: gh api'), { stderr: `gh: HTTP ${status} Server Error\n` })
const harness = (outcomes) => {
    const calls = [],
        sleeps = [],
        logs = []
    const run = (command, args, options) => {
        calls.push({ command, args, options })
        const next = outcomes.shift()
        if (next instanceof Error) throw next
        return next
    }
    return { calls, sleeps, logs, deps: { run, sleep: (ms) => sleeps.push(ms), log: (line) => logs.push(line) } }
}

test('retries a 502 and returns the next success with the caller options', () => {
    const h = harness([httpError(502), '{"ok":true}'])
    const options = { encoding: 'utf8', timeout: 60000, maxBuffer: 1024 }
    assert.equal(ghApiSync(['repos/a/b/actions/runs/1/jobs'], options, h.deps), '{"ok":true}')
    assert.equal(h.calls.length, 2)
    assert.deepEqual(h.calls[1].args, ['api', 'repos/a/b/actions/runs/1/jobs'])
    assert.equal(h.calls[1].options, options)
    assert.deepEqual(h.sleeps, [2000])
    assert.equal(h.logs.length, 1)
    assert.match(h.logs[0], /502.*1\/3/)
})

test('throws the last error after three 502 attempts', () => {
    const errors = [httpError(502), httpError(502), httpError(502)]
    const h = harness([...errors])
    assert.throws(
        () => ghApiSync(['x'], {}, h.deps),
        (error) => error === errors[2]
    )
    assert.equal(h.calls.length, 3)
    assert.deepEqual(h.sleeps, [2000, 5000])
    assert.equal(h.logs.length, 2)
})

test('fails at once on 4xx responses', () => {
    for (const status of [403, 404, 422]) {
        const h = harness([httpError(status), '{}'])
        assert.throws(() => ghApiSync(['x'], {}, h.deps), /Command failed/)
        assert.equal(h.calls.length, 1)
        assert.deepEqual(h.sleeps, [])
    }
})

test('retries 429, secondary rate limits and network errors', () => {
    const secondary = Object.assign(new Error('failed'), {
        stderr: 'gh: You have exceeded a secondary rate limit. (HTTP 403)\n',
    })
    for (const error of [
        httpError(429),
        secondary,
        Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' }),
    ]) {
        const h = harness([error, 'ok'])
        assert.equal(ghApiSync(['x'], {}, h.deps), 'ok')
        assert.equal(h.calls.length, 2)
    }
})

test('retries a timeout killed by execFileSync', () => {
    const timeout = Object.assign(new Error('spawnSync gh ETIMEDOUT'), {
        code: 'ETIMEDOUT',
        killed: true,
        signal: 'SIGTERM',
    })
    const h = harness([timeout, 'ok'])
    assert.equal(ghApiSync(['x'], { timeout: 1 }, h.deps), 'ok')
    assert.match(h.logs[0], /ETIMEDOUT/)
})

test('does not retry a plain 403 or an unrelated failure', () => {
    assert.equal(isTransientGhError(httpError(403)), false)
    assert.equal(isTransientGhError(new Error('invalid JSON')), false)
    assert.equal(isTransientGhError(Object.assign(new Error('x'), { code: 'ENOBUFS' })), false)
})
