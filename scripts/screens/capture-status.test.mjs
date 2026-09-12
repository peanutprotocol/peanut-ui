import { test } from 'node:test'
import assert from 'node:assert/strict'
import { captureExitCode } from './capture-status.mjs'

test('publishable gaps keep a current capture command green', () => {
    assert.equal(captureExitCode(false, [{ status: 'unavailable' }, { status: 'excluded' }, { status: 'absent' }]), 0)
})

test('a current per-screen runtime failure keeps the capture command red', () => {
    assert.equal(captureExitCode(false, [{ status: 'captured' }, { status: 'failed' }]), 1)
})

test('historical unavailable states never fail the capture command', () => {
    assert.equal(captureExitCode(true, [{ status: 'unavailable' }, { status: 'failed' }]), 0)
})
