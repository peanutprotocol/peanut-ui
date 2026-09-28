import assert from 'node:assert/strict'
import test from 'node:test'
import { captureProfile } from './capture-profiles.mjs'

test('the main-triggered baseline retains its default and three additional viewport profiles', () => {
    const iphone = captureProfile()
    assert.deepEqual(
        { name: iphone.name, width: iphone.width, height: iphone.height, device: iphone.device },
        {
            name: '393x852',
            width: 393,
            height: 852,
            device: {
                platform: 'ios',
                label: 'iPhone',
                cutout: 'dynamic-island',
                safeArea: { top: 59, right: 0, bottom: 34, left: 0 },
            },
        }
    )
    assert.equal(captureProfile('440x956').device.platform, 'ios')
    assert.deepEqual(captureProfile('440x956').device.safeArea, { top: 62, right: 0, bottom: 34, left: 0 })
    assert.equal(captureProfile('360x800').device.platform, 'android')
    assert.deepEqual(captureProfile('360x800').device.safeArea, { top: 24, right: 0, bottom: 24, left: 0 })
    assert.equal(captureProfile('320x712').device.platform, 'android')
    assert.throws(() => captureProfile('390x844'), /Unsupported capture profile/)
})
