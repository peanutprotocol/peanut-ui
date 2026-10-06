import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import test from 'node:test'
import { materializeCatalogue, validateCapture } from './core.mjs'

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

test('the actual screen catalogue produces valid capture manifests in every locale', () => {
    for (const locale of ['en', 'es-419', 'es-AR', 'pt-BR']) {
        const manifest = validateCapture({
            schema: 1,
            type: 'capture',
            commit: 'a'.repeat(40),
            contentCommit: 'b'.repeat(40),
            harness: 'c'.repeat(64),
            fixtures: 'd'.repeat(64),
            environment: 'catalogue-test',
            adapter: 'v1',
            capturedAt: '2026-10-06T00:00:00Z',
            locale,
            profile: `${locale}-393x852`,
            width: 393,
            height: 852,
            screens: materializeCatalogue(screens, []),
            inventory: [],
        })
        assert.equal(manifest.screens.length, screens.length)
        assert.ok(manifest.screens.every(({ order }) => Number.isInteger(order)))
    }
})

test('account setup keeps distinct integer steps in the intended journey order', () => {
    const setup = screens.filter(({ journey }) => journey === 'Account setup')
    assert.equal(new Set(setup.map(({ order }) => order)).size, setup.length)
    assert.ok(setup.every(({ order }) => Number.isInteger(order)))
    assert.deepEqual(
        setup.map(({ id }) => id),
        [
            '01-b-first-launch-intro',
            '01-a-landing',
            '06-a-signup',
            '04-b-advantage-fees',
            '03-a-residence-select',
            '03-c-residence-congrats',
            '03-b-advantage-bank',
            '03-f-advantage-exchange',
            '03-d-funding-methods',
            '02-b-advantage-card',
            '03-e-advantage-local',
            '03-g-advantage-people',
            '07-a-setuppasskey',
            '08-a-passkeysetuphelpmodal',
            '09-a-passkeyinfomodal',
            '07-c-notification-email',
            '07-d-notification-settings',
            '07-b-advantage-control',
            '05-a-signtesttransaction',
            '07-e-setup-celebration',
            '20-a-setupnotificationsmodal',
        ]
    )
})
