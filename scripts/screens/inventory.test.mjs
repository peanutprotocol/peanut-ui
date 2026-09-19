import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { test } from 'node:test'

test('the current catalogue accounts for every app route', () => {
    const output = execFileSync(process.execPath, ['--import', 'tsx', 'scripts/screens/inventory.ts'], {
        encoding: 'utf8',
    })
    const result = JSON.parse(output)
    const missing = result.filter((entry) => entry.status === 'missing')
    assert.deepEqual(missing, [])

    const routingAliases = new Set([
        '/qr',
        '/points',
        '/points/invites',
        '/card-payment',
        '/request/pay',
        '/pay/[...recipient]',
        '/profile/identity-verification',
        '/profile/identity-verification/additional',
    ])
    const aliases = result.filter((entry) => routingAliases.has(entry.route))
    assert.equal(aliases.length, routingAliases.size)
    assert.ok(aliases.every((entry) => entry.status === 'excluded' && entry.reason.includes('Routing alias')))
})
