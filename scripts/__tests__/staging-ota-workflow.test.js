/** @jest-environment node */

const fs = require('node:fs')
const path = require('node:path')

const workflow = fs.readFileSync(
    path.join(__dirname, '..', '..', '.github', 'workflows', 'staging-ota.yml'),
    'utf8'
)

describe('App Staging OTA workflow', () => {
    it('manually publishes a dev build to Capgo staging without touching production', () => {
        expect(workflow).toContain('name: App Staging OTA')
        expect(workflow).toContain('workflow_dispatch:')
        expect(workflow).toContain('staging OTAs are published from dev')
        expect(workflow).toContain('VERSION="$(node scripts/release-version.mjs staging)"')
        expect(workflow).toContain('CHANNEL: staging')
        expect(workflow).toContain('--channel "$CHANNEL"')
        expect(workflow).toContain('node scripts/check-native-ota-surface.mjs "v$FLOOR" --platform android')
        expect(workflow).not.toContain('CHANNEL: production')
        expect(workflow).not.toContain('git push origin "ota-')
    })
})
