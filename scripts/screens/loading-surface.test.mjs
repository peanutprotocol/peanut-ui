import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import test from 'node:test'

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

test('only the processing withdrawal capture intentionally retains a visible spinner', () => {
    for (const [id, expectsLoading] of [
        ['89-f-withdraw-review-insufficient', false],
        ['90-f-withdraw-review-processing', true],
        ['91-f-withdraw-review-spent', false],
    ]) {
        const screen = screens.find((entry) => entry.id === id)
        assert.ok(screen, `${id} must be registered`)
        assert.equal(screen.expectsLoading, expectsLoading, id)
    }
})
