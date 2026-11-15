import assert from 'node:assert/strict'
import test from 'node:test'
import { remoteOptimizedCaptureImage, REMOTE_IMAGE_PLACEHOLDER } from './capture-images.mjs'

const appOrigin = 'https://staging.peanut.me'

function optimized(source) {
    const request = new URL('/_next/image', appOrigin)
    request.searchParams.set('url', source)
    request.searchParams.set('w', '32')
    request.searchParams.set('q', '75')
    return request.href
}

test('keeps the offline placeholder for external images without a pinned source', () => {
    for (const source of [
        'https://assets.coingecko.com/asset_platforms/images/32239/katana.jpg',
        'https://other.example/asset_platforms/images/279/standard/ethereum.png?1706606803',
    ]) {
        assert.deepEqual(remoteOptimizedCaptureImage(optimized(source), appOrigin), {
            contentType: 'image/svg+xml',
            body: REMOTE_IMAGE_PLACEHOLDER,
        })
    }
})

test('captures the three network chooser logos offline with distinct PNG bytes', () => {
    const logoPrefix = 'https://assets.coingecko.com/asset_platforms/images/'
    const logos = [
        '279/standard/ethereum.png?1706606803',
        '5/standard/solana.png?1706606708',
        '1094/standard/TRON_LOGO.png?1706606652',
    ].map((name) => remoteOptimizedCaptureImage(optimized(logoPrefix + name), appOrigin))
    for (const logo of logos) {
        assert.equal(logo?.contentType, 'image/png')
        assert.equal(logo.body.subarray(0, 8).toString('hex'), '89504e470d0a1a0a')
    }
    assert.equal(new Set(logos.map((logo) => logo.body.toString('hex'))).size, 3)
})

test('leaves local optimized images and unrelated routes untouched', () => {
    assert.equal(remoteOptimizedCaptureImage(optimized('/logo.png'), appOrigin), null)
    assert.equal(remoteOptimizedCaptureImage(`${appOrigin}/logo.png`, appOrigin), null)
    assert.equal(remoteOptimizedCaptureImage('not a url', appOrigin), null)
})

test('ships a self-contained placeholder with no remote references', () => {
    assert.match(REMOTE_IMAGE_PLACEHOLDER, /^<svg[\s\S]*<\/svg>$/)
    assert.doesNotMatch(REMOTE_IMAGE_PLACEHOLDER, /(?:href|src)=["']https?:\/\//)
})
