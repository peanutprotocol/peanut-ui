/** @jest-environment node */

const fs = require('node:fs')
const path = require('node:path')

const workflow = fs.readFileSync(path.join(__dirname, '..', '..', '.github', 'workflows', 'release-ota.yml'), 'utf8')

describe('App Release OTA native surface gate', () => {
    it('validates an attested same-version Android replacement baseline', () => {
        expect(workflow).toContain('node scripts/check-native-capabilities.mjs "v$FLOOR"')
        expect(workflow).toContain('node scripts/check-native-ota-surface.mjs "v$FLOOR" --platform android')
        expect(workflow).not.toContain('node scripts/native-fingerprint.mjs --diff "v$FLOOR"')
    })
})
