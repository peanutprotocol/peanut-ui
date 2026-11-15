import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import test from 'node:test'
import { waitForFixtureReady } from './fixture-readiness.mjs'

const screens = JSON.parse(
    execFileSync(
        process.execPath,
        [
            '--import',
            'tsx',
            '-e',
            "const { SCREENS } = require('./src/dev/screens/catalogue.ts'); console.log(JSON.stringify(SCREENS))",
        ],
        { encoding: 'utf8' }
    )
)

test('all six funding fixtures carry their readiness selector into the capture catalogue', () => {
    const ids = ['needed', 'enrollment', 'migration', 'return', 'withdrawal-in-flight', 'pending']
    const funding = ids.map((id) => screens.find((screen) => screen.id === `fixture-card-funding-${id}`))
    assert.ok(funding.every(Boolean))
    for (const screen of funding) assert.ok(screen.waitFor, screen.id)
})

test('capture waits for the declared selector and propagates timeout', async () => {
    const calls = []
    const page = {
        locator: (selector) => ({
            first: () => ({
                waitFor: async (options) => {
                    calls.push([selector, options])
                    throw new Error('not ready')
                },
            }),
        }),
    }
    await assert.rejects(waitForFixtureReady(page, '[data-ready]'), /not ready/)
    assert.deepEqual(calls, [['[data-ready]', { state: 'visible', timeout: 15000 }]])
})
