import { test } from 'node:test'
import assert from 'node:assert/strict'
import { captureExitCode } from './capture-status.mjs'

test('zero screenshots is fatal, and a finished state gap cannot spoil another capture', () => {
    const gaps = ['failed', 'unavailable', 'excluded', 'absent'].map((status) => ({ status }))
    for (let mask = 0; mask < 16; mask++) {
        const rows = gaps.filter((_, index) => mask & (1 << index))
        assert.notEqual(captureExitCode(rows), 0)
        for (let position = 0; position <= rows.length; position++)
            assert.equal(captureExitCode(rows.toSpliced(position, 0, { status: 'captured' })), 0)
    }
})
