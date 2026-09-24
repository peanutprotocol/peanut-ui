import assert from 'node:assert/strict'
import test from 'node:test'
import { installCaptureSafeArea } from './capture-safe-area.mjs'

const device = { safeArea: { top: 24, right: 0, bottom: 24, left: 0 } }

test('safe-area variables are installed when the document root already exists', () => {
    const properties = new Map()
    globalThis.document = {
        documentElement: { style: { setProperty: (name, value) => properties.set(name, value) } },
    }
    try {
        installCaptureSafeArea(device)
        assert.equal(properties.get('--safe-area-inset-top'), '24px')
        assert.equal(properties.get('--safe-area-inset-bottom'), '24px')
    } finally {
        delete globalThis.document
    }
})

test('safe-area installation waits for the document root', () => {
    const properties = new Map()
    let apply
    let disconnected = false
    globalThis.document = { documentElement: null }
    globalThis.MutationObserver = class {
        constructor(callback) {
            apply = callback
        }
        observe(target, options) {
            assert.equal(target, globalThis.document)
            assert.deepEqual(options, { childList: true })
        }
        disconnect() {
            disconnected = true
        }
    }
    try {
        installCaptureSafeArea(device)
        globalThis.document.documentElement = {
            style: { setProperty: (name, value) => properties.set(name, value) },
        }
        apply()
        assert.equal(properties.get('--safe-area-inset-top'), '24px')
        assert.equal(properties.get('--safe-area-inset-bottom'), '24px')
        assert.equal(disconnected, true)
    } finally {
        delete globalThis.document
        delete globalThis.MutationObserver
    }
})
