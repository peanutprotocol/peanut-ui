/**
 * Chip, ui#3904: process arguments are readable by any local account, so the
 * test OTA upload passes the signing key by path and the Capgo token in the
 * environment, never as argument values.
 */
const { readFileSync } = require('fs')
const { join } = require('path')

const source = readFileSync(join(__dirname, '..', 'test-ota.mjs'), 'utf8')

describe('test-ota upload', () => {
    it('passes the signing key by path, not its contents', () => {
        expect(source).not.toMatch(/--key-data-v2/)
        expect(source).not.toMatch(/readFileSync\(keyPath/)
        expect(source).toMatch(/'--key-v2',\s*keyPath/)
    })

    it('hands the Capgo token over in the environment, not in argv', () => {
        expect(source).not.toMatch(/--apikey/)
        expect(source).toMatch(/CAPGO_TOKEN: apiKey/)
    })
})
