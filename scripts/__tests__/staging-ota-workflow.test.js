/** @jest-environment node */

const fs = require('node:fs')
const path = require('node:path')

const workflow = fs.readFileSync(path.join(__dirname, '..', '..', '.github', 'workflows', 'staging-ota.yml'), 'utf8')

describe('App Staging OTA workflow', () => {
    it('manually publishes a dev build to Capgo staging without touching production', () => {
        expect(workflow).toContain('name: App Staging OTA')
        expect(workflow).toContain('workflow_dispatch:')
        expect(workflow).toContain("default: 'dev'")
        expect(workflow).toContain("ref: ${{ inputs.ref || 'dev' }}")
        expect(workflow).toContain('staging OTAs are published from dev')
        expect(workflow).toContain('VERSION="$(node scripts/release-version.mjs staging)"')
        expect(workflow).toContain('CHANNEL: staging')
        expect(workflow).toContain('--channel "$CHANNEL"')
        expect(workflow).toContain('node scripts/check-native-ota-surface.mjs "v$FLOOR" --platform android')
        expect(workflow).not.toContain('CHANNEL: production')
        expect(workflow).not.toContain('git push origin "ota-')
    })

    // The bundle sends analytics only when its base URL is https://peanut.me, so
    // a staging bundle must never fall back to the production URL (TASK-23883).
    it('refuses to build a staging bundle with the production base URL', () => {
        expect(workflow).toContain('NEXT_PUBLIC_BASE_URL=${{ vars.STAGING_OTA_BASE_URL }}')
        expect(workflow).not.toMatch(/STAGING_OTA_BASE_URL \|\|/)
        const guard = workflow.match(/if \[ "\$STAGING_BASE_URL" != [^\n]*\n[\s\S]*?\n\s+fi/)[0]
        const run = (url) =>
            require('node:child_process').spawnSync('bash', ['-eu', '-c', guard.replace(/^ +/gm, '')], {
                env: { ...process.env, STAGING_BASE_URL: url },
                encoding: 'utf8',
            }).status
        expect(run('')).toBe(1)
        expect(run('https://peanut.me')).toBe(1)
        // dotenv strips quotes and padding, so these would bake the production URL
        expect(run('"https://peanut.me"')).toBe(1)
        expect(run(' https://peanut.me ')).toBe(1)
        expect(run('https://staging.peanut.me')).toBe(0)
    })
})
