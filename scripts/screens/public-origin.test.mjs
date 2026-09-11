import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizePublicOrigin } from './public-origin.mjs'

test('normalizes a trailing slash before constructing public links', () => {
    assert.equal(normalizePublicOrigin('https://screens.example/'), 'https://screens.example')
})

test('rejects non-origin public URLs', () => {
    for (const value of ['http://screens.example', 'https://screens.example/path', 'https://user:pass@screens.example'])
        assert.throws(() => normalizePublicOrigin(value), /HTTPS origin/)
})
