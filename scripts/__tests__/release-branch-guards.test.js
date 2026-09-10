/** @jest-environment node */

const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

// Execute only the branch guard, never the version resolver or deployment steps.
describe.each(['release-ota.yml', 'release-native.yml', 'android-release.yml'])('%s release branches', (file) => {
    const workflow = fs.readFileSync(path.join(__dirname, '..', '..', '.github', 'workflows', file), 'utf8')
    const guard = workflow.match(/if \[ "\$GITHUB_REF_NAME"[^\n]+; then\n[\s\S]*?\n\s+fi/)[0]

    it.each(['dev', 'main', 'release/android-kyc'])('accepts %s', (branch) => {
        const result = spawnSync('bash', ['-eu', '-c', guard], {
            env: { ...process.env, GITHUB_REF_NAME: branch },
            encoding: 'utf8',
        })
        expect(result.status).toBe(0)
    })

    it.each(['feature/kyc', 'release/other', 'main-fix', ''])('rejects unrelated branch %s', (branch) => {
        const result = spawnSync('bash', ['-eu', '-c', guard], {
            env: { ...process.env, GITHUB_REF_NAME: branch },
            encoding: 'utf8',
        })
        expect(result.status).toBe(1)
        expect(result.stderr).toContain('::error::')
    })
})
