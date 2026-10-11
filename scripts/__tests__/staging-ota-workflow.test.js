/** @jest-environment node */

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const workflow = fs.readFileSync(path.join(__dirname, '..', '..', '.github', 'workflows', 'staging-ota.yml'), 'utf8')

function surfaceShell() {
    const step = workflow.indexOf('- name: Check that a shipped binary can run this tree')
    const runStart = workflow.indexOf('run: |', step)
    const nextStep = workflow.indexOf('\n            - name:', runStart)
    return workflow
        .slice(runStart + 'run: |\n'.length, nextStep)
        .split('\n')
        .map((line) => line.replace(/^ {18}/, ''))
        .join('\n')
}

function runSurface(event, compatible) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'staging-surface-'))
    const output = path.join(dir, 'output')
    const script = `
        node() {
            case "$*" in
                *native-floor*) printf '1.9.0\\n' ;;
                *check-native-ota-surface*) [ "$COMPATIBLE" = true ] ;;
                *) return 0 ;;
            esac
        }
        ${surfaceShell()}
    `
    const result = spawnSync('bash', ['-eo', 'pipefail', '-c', script], {
        env: { ...process.env, EVENT_NAME: event, COMPATIBLE: String(compatible), GITHUB_OUTPUT: output },
        encoding: 'utf8',
    })
    const outputs = fs.existsSync(output) ? fs.readFileSync(output, 'utf8') : ''
    fs.rmSync(dir, { recursive: true, force: true })
    return { status: result.status, outputs }
}

describe('App Staging OTA workflow', () => {
    it('publishes every dev push, or a manual dev dispatch, to Capgo staging without touching production', () => {
        expect(workflow).toContain('name: App Staging OTA')
        expect(workflow).toMatch(/push:\n\s+branches: \[dev\]/)
        expect(workflow).toContain('workflow_dispatch:')
        expect(workflow).toContain("default: 'dev'")
        expect(workflow).toContain("ref: ${{ github.event_name == 'push' && github.sha || inputs.ref || 'dev' }}")
        expect(workflow).toContain('staging OTAs are published from dev')
        expect(workflow).toContain('environment: Staging-OTA')
        expect(workflow).toContain('VERSION="$(node scripts/release-version.mjs staging)"')
        expect(workflow).toContain('CHANNEL: staging')
        expect(workflow).toContain('--channel "$CHANNEL"')
        expect(workflow).toContain('--key-data-v2 "$CAPGO_PRIVATE_KEY"')
        expect(workflow).toContain('node scripts/check-native-ota-surface.mjs "v$FLOOR" --platform android')
        expect(workflow).not.toContain('CHANNEL: production')
        expect(workflow).not.toContain('mobile-release')
        expect(workflow).not.toContain('promote-production')
        expect(workflow).not.toContain('git push origin')
    })

    it('skips the upload for a push when dev has native changes, and fails a manual dispatch', () => {
        expect(runSurface('push', true)).toEqual({ status: 0, outputs: 'publish=true\n' })
        expect(runSurface('push', false)).toEqual({ status: 0, outputs: 'publish=false\n' })
        expect(runSurface('workflow_dispatch', true)).toEqual({ status: 0, outputs: 'publish=true\n' })
        expect(runSurface('workflow_dispatch', false).status).toBe(1)
    })

    it('gates every build and upload step on the surface check', () => {
        const gated = workflow.match(/if: steps\.surface\.outputs\.publish == 'true'/g)
        expect(gated).toHaveLength(7)
    })
})
