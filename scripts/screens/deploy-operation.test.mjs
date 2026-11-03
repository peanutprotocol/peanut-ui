import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

// A4 public contract: bash helper PHASE COMMAND ARGS..., one attempt, 270s
// timeout, progress, preserved status and useful sanitized failure diagnostics.
// Fake timeout executes immediately and records its arguments; no provider or
// wall-clock timeout is exercised by these small deterministic acceptance tests.
const token = 'configured-cloudflare-secret-token-12345'
const account = '1234567890abcdef1234567890abcdef'
const bearer = 'unconfigured.bearer-secret-12345.signature'
const labelledToken = 'labelled-api-token-secret-67890'
const otherAccount = 'fedcba0987654321fedcba0987654321'

function operation(
    t,
    { status = 17, noisy = false, privateLog = false, largePrivateLog = false, oversizedPrivateLog = false } = {}
) {
    const directory = mkdtempSync(join(tmpdir(), 'screen-deploy-fixture-'))
    t.after(() => rmSync(directory, { recursive: true, force: true }))
    const calls = join(directory, 'calls')
    const timeoutArgs = join(directory, 'timeout.json')
    writeFileSync(
        join(directory, 'timeout'),
        `#!${process.execPath}
const fs = require('node:fs')
const { spawnSync } = require('node:child_process')
const args = process.argv.slice(2)
fs.writeFileSync(process.env.TIMEOUT_ARGS, JSON.stringify(args))
const duration = args.findIndex(arg => /^\\d+(?:s|m)?$/.test(arg))
if (duration < 0) process.exit(98)
const child = spawnSync(args[duration + 1], args.slice(duration + 2), { stdio: 'inherit' })
process.exit(child.status ?? 99)
`,
        { mode: 0o755 }
    )
    const command = join(directory, 'command.cjs')
    writeFileSync(
        command,
        `const fs = require('node:fs')
fs.appendFileSync(process.env.OPERATION_CALLS, 'attempt\\n')
if (${privateLog}) {
  if (!process.env.WRANGLER_LOG_PATH?.endsWith('.log')) {
    console.error('Fixture requires a private Wrangler .log path')
    process.exit(96)
  }
  fs.writeFileSync(process.env.WRANGLER_LOG_PATH,
    '\\n--- 2026-11-03T00:00:00.000Z debug\\n' +
    (${largePrivateLog} ? 'debug body line\\n'.repeat(${oversizedPrivateLog} ? 300000 : 20000) + '\\n--- 2026-11-03T00:00:00.001Z log\\n' : '') +
    'HTTP body: arbitrary-private-request-body-98765\\n---\\n' +
    '\\n--- 2026-11-03T00:00:00.000Z log\\n[ERROR] A request to the Cloudflare API (/accounts/${otherAccount}/d1/database/db/query) failed.\\n  permission denied [code: 10000]\\n---\\n')
  process.exit(${status})
}
if (${noisy}) process.stdout.write('irrelevant progress line\\n'.repeat(50000))
console.log('Migration 0003_comments.sql started; stdout detail')
console.error('D1 SQLITE_CONSTRAINT error code 10021: migration failed; stderr detail')
console.error('secret=' + process.env.CLOUDFLARE_API_TOKEN)
console.error('account=' + process.env.CLOUDFLARE_ACCOUNT_ID)
console.error('Authorization: Bearer ${bearer}')
console.error('api_token=${labelledToken}')
console.error('https://api.cloudflare.com/client/v4/accounts/${otherAccount}/d1/database/db')
console.error('\\u001b[31mcolored diagnostic\\u001b[0m\\u0007')
console.error('::add-mask::injected-mask')
console.error('::stop-commands::injected-stop')
process.exitCode = ${status}
`
    )
    const result = spawnSync('bash', ['scripts/screens/deploy-operation.sh', 'migration', process.execPath, command], {
        encoding: 'utf8',
        timeout: 10_000,
        maxBuffer: 2 * 1024 * 1024,
        env: {
            ...process.env,
            PATH: `${directory}:${process.env.PATH}`,
            CLOUDFLARE_API_TOKEN: token,
            CLOUDFLARE_ACCOUNT_ID: account,
            OPERATION_CALLS: calls,
            TIMEOUT_ARGS: timeoutArgs,
        },
    })
    assert.ifError(result.error)
    return { ...result, directory, calls, timeoutArgs, output: result.stdout + result.stderr }
}

test('failed command retains its status and useful diagnostics without leaking credentials or log controls', (t) => {
    const result = operation(t)
    assert.equal(result.status, 17, result.output)
    assert.equal(readFileSync(result.calls, 'utf8'), 'attempt\n', 'no automatic retries')
    assert.match(result.output, /0003_comments\.sql/)
    assert.match(result.output, /SQLITE_CONSTRAINT/)
    assert.match(result.output, /10021/)
    assert.match(result.output, /stdout detail/)
    assert.match(result.output, /stderr detail/)
    for (const secret of [token, account, bearer, labelledToken, otherAccount])
        assert.ok(!result.output.includes(secret), `must redact ${secret}`)
    assert.doesNotMatch(result.output, /[\u0000-\u0008\u000b-\u001f\u007f]/)
    assert.doesNotMatch(result.output, /^::(?:add-mask|stop-commands)::/m)
    const timeout = JSON.parse(readFileSync(result.timeoutArgs, 'utf8'))
    assert.ok(
        timeout.some((arg) => /^270s?$/.test(arg)),
        'retain the 270-second command budget'
    )
    assert.match(result.output, /phase=migration/)
    assert.match(result.output, /elapsed(?:_seconds)?=/)
    assert.match(result.output, /retr(?:y|ies)=0/)
})

test('success remains successful and runs the operation once', (t) => {
    const result = operation(t, { status: 0 })
    assert.equal(result.status, 0, result.output)
    assert.equal(readFileSync(result.calls, 'utf8'), 'attempt\n')
    assert.match(result.output, /phase=migration/)
    assert.match(result.output, /(?:completed=1\/1|completed=1\s+total=1)/)
})

test('large command output is bounded while retaining the final useful failure', (t) => {
    const result = operation(t, { noisy: true })
    assert.equal(result.status, 17, result.output.slice(-2000))
    assert.ok(Buffer.byteLength(result.output) < 1024 * 1024, 'diagnostic output must be bounded')
    assert.match(result.output, /SQLITE_CONSTRAINT/)
    assert.match(result.output, /10021/)
    assert.ok(!result.output.includes(token))
})

test('failure exposes useful private Wrangler log records while withholding debug HTTP bodies', (t) => {
    const result = operation(t, { privateLog: true })
    assert.equal(result.status, 17, result.output)
    assert.equal(readFileSync(result.calls, 'utf8'), 'attempt\n')
    assert.match(result.output, /permission denied/)
    assert.match(result.output, /10000/)
    assert.ok(!result.output.includes(otherAccount), 'private log account IDs must also be sanitized')
    assert.doesNotMatch(result.output, /arbitrary-private-request-body-98765|HTTP body:/)
})

test('large debug records never expose private bodies through a truncated log tail', (t) => {
    const result = operation(t, { privateLog: true, largePrivateLog: true })
    assert.equal(result.status, 17, result.output)
    assert.match(result.output, /permission denied/)
    assert.match(result.output, /10000/)
    assert.doesNotMatch(result.output, /arbitrary-private-request-body-98765|HTTP body:/)
})

test('oversized private logs fail closed with an explicit diagnostic limit message', (t) => {
    const result = operation(t, { privateLog: true, largePrivateLog: true, oversizedPrivateLog: true })
    assert.equal(result.status, 17, result.output)
    assert.match(result.output, /4 MiB safe read limit/)
    assert.doesNotMatch(result.output, /arbitrary-private-request-body-98765|HTTP body:/)
})

test('timeout status remains terminal without a success receipt or retries', (t) => {
    const result = operation(t, { status: 124 })
    assert.equal(result.status, 124, result.output)
    assert.equal(readFileSync(result.calls, 'utf8'), 'attempt\n')
    assert.match(result.output, /status=failed exit_code=124/)
    assert.doesNotMatch(result.output, /completed=1\/1/)
})
