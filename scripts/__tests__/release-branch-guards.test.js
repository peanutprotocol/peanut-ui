/** @jest-environment node */

const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const workflowsDir = path.join(__dirname, '..', '..', '.github', 'workflows')

// Execute only the branch guard, never the version resolver or deployment steps.
function guardOf(file) {
    const workflow = fs.readFileSync(path.join(workflowsDir, file), 'utf8')
    return workflow.match(/if \[ "\$GITHUB_REF_NAME"[^\n]+; then\n[\s\S]*?\n\s+fi/)[0]
}

function run(guard, branch) {
    return spawnSync('bash', ['-eu', '-c', guard], {
        env: { ...process.env, GITHUB_REF_NAME: branch },
        encoding: 'utf8',
    })
}

// Backport the OTA protections without changing the existing manual refs.
describe('release-ota.yml manual release branches', () => {
    const guard = guardOf('release-ota.yml')

    it.each(['dev', 'main', 'release/android-kyc'])('accepts %s', (branch) => {
        expect(run(guard, branch).status).toBe(0)
    })

    it.each(['feature/kyc', 'release/other', 'main-fix', ''])('refuses %s', (branch) => {
        const result = run(guard, branch)
        expect(result.status).toBe(1)
        expect(result.stderr).toContain('::error::')
    })

    it('requires a manual dispatch, never a push or tag', () => {
        const workflow = fs.readFileSync(path.join(workflowsDir, 'release-ota.yml'), 'utf8')
        const triggers = workflow.match(/^on:\n([\s\S]*?)(?=^\S)/m)[1]
        expect(triggers.trim()).toBe('workflow_dispatch:')
    })
})

// The native lanes still cut releases from dev; unchanged, and deliberately so.
describe.each(['release-native.yml', 'android-release.yml'])('%s release branches', (file) => {
    const guard = guardOf(file)

    it.each(['dev', 'main', 'release/android-kyc'])('accepts %s', (branch) => {
        expect(run(guard, branch).status).toBe(0)
    })

    it.each(['feature/kyc', 'release/other', 'main-fix', ''])('rejects unrelated branch %s', (branch) => {
        const result = run(guard, branch)
        expect(result.status).toBe(1)
        expect(result.stderr).toContain('::error::')
    })
})
