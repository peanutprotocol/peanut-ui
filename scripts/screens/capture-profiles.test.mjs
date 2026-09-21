import assert from 'node:assert/strict'
import test from 'node:test'
import { captureProfile } from './capture-profiles.mjs'

test('the main-triggered baseline retains its default and three additional viewport profiles', () => {
    assert.deepEqual(captureProfile(), { name: '393x852', width: 393, height: 852 })
    assert.deepEqual(captureProfile('440x956'), { name: '440x956', width: 440, height: 956 })
    assert.deepEqual(captureProfile('360x800'), { name: '360x800', width: 360, height: 800 })
    assert.deepEqual(captureProfile('320x712'), { name: '320x712', width: 320, height: 712 })
    assert.throws(() => captureProfile('390x844'), /Unsupported capture profile/)
})
