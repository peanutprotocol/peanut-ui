import assert from 'node:assert/strict'
import test from 'node:test'
import { isRemoteOptimizedImage, REMOTE_IMAGE_PLACEHOLDER } from './capture-images.mjs'

const appOrigin = 'https://staging.peanut.me'

test('recognizes external images hidden behind the Next.js optimizer', () => {
    const request = new URL('/_next/image', appOrigin)
    request.searchParams.set('url', 'https://assets.coingecko.com/asset_platforms/images/32239/katana.jpg')
    request.searchParams.set('w', '32')
    request.searchParams.set('q', '75')
    assert.equal(isRemoteOptimizedImage(request.href, appOrigin), true)
})

test('leaves local optimized images and unrelated routes untouched', () => {
    assert.equal(isRemoteOptimizedImage(`${appOrigin}/_next/image?url=%2Flogo.png&w=32&q=75`, appOrigin), false)
    assert.equal(isRemoteOptimizedImage(`${appOrigin}/logo.png`, appOrigin), false)
    assert.equal(isRemoteOptimizedImage('not a url', appOrigin), false)
})

test('ships a self-contained placeholder with no remote references', () => {
    assert.match(REMOTE_IMAGE_PLACEHOLDER, /^<svg[\s\S]*<\/svg>$/)
    assert.doesNotMatch(REMOTE_IMAGE_PLACEHOLDER, /(?:href|src)=["']https?:\/\//)
})
